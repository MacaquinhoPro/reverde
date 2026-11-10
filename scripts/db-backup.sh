#!/usr/bin/env bash
#
# Respaldo de la base de datos de Reverde.
#
#   npm run db:backup                    # usa DATABASE_URL del ambiente
#   DATABASE_URL=… npm run db:backup     # una base concreta
#   RETENTION_DAYS=30 npm run db:backup  # cambia la retención
#
# Genera un volcado comprimido en formato personalizado de PostgreSQL
# (-Fc), que permite restaurar tablas por separado y es más compacto que SQL
# plano. Al final verifica que el archivo se puede leer: un respaldo que no
# se ha verificado no es un respaldo.
#
# Procedimiento completo, frecuencia y RTO/RPO: docs/runbooks/backup-recovery.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Carga DATABASE_URL de los archivos de ambiente si no viene ya definida.
if [[ -z "${DATABASE_URL:-}" ]]; then
  for f in "$ROOT/.env.local" "$ROOT/.env" "$ROOT/.env.development"; do
    if [[ -f "$f" ]]; then
      # shellcheck disable=SC2046
      export $(grep -E '^DATABASE_URL=' "$f" | tail -1 | xargs -0 echo) 2>/dev/null || true
      [[ -n "${DATABASE_URL:-}" ]] && break
    fi
  done
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "✗ DATABASE_URL no está definida y no se encontró en los archivos .env" >&2
  echo "  Ejemplo: DATABASE_URL=postgresql://reverde:reverde@localhost:5433/reverde_dev npm run db:backup" >&2
  exit 1
fi

# Dos formas de ejecutar pg_dump: el binario del sistema o el que ya viene en
# el contenedor de PostgreSQL. La segunda evita tener que instalar libpq, pero
# solo vale para la base local de docker-compose.
DUMP_MODE=""
if command -v pg_dump >/dev/null 2>&1; then
  DUMP_MODE="local"
elif command -v docker >/dev/null 2>&1 && docker compose ps db --status running 2>/dev/null | grep -q db; then
  DUMP_MODE="docker"
  echo "ℹ pg_dump no está en el sistema: se usa el del contenedor «db»."
else
  echo "✗ No hay forma de ejecutar pg_dump." >&2
  echo "  Opción 1 · instálalo:" >&2
  echo "      macOS:         brew install libpq && brew link --force libpq" >&2
  echo "      Debian/Ubuntu: sudo apt-get install postgresql-client" >&2
  echo "  Opción 2 · levanta la base en Docker y vuelve a intentar:" >&2
  echo "      npm run db:up" >&2
  exit 1
fi

# Credenciales del contenedor local (las de docker-compose.yml).
PG_CONTAINER_USER="${PG_CONTAINER_USER:-reverde}"
PG_CONTAINER_DB="${PG_CONTAINER_DB:-reverde_dev}"

run_pg_dump() {
  if [[ "$DUMP_MODE" == "local" ]]; then
    pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 \
      --no-owner --no-privileges --file="$1"
  else
    # Dentro del contenedor la base se alcanza por localhost:5432.
    docker compose exec -T db pg_dump \
      --username="$PG_CONTAINER_USER" --dbname="$PG_CONTAINER_DB" \
      --format=custom --compress=9 --no-owner --no-privileges > "$1"
  fi
}

run_pg_restore_list() {
  if [[ "$DUMP_MODE" == "local" ]]; then
    pg_restore --list "$1"
  else
    docker compose exec -T db pg_restore --list < "$1"
  fi
}

# El nombre de la base, solo para etiquetar el archivo (sin credenciales).
DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
OUT="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"
echo "→ Respaldando «$DB_NAME» en $OUT"

# --no-owner y --no-privileges: el volcado se puede restaurar en una base con
# otro usuario (la gestionada de producción no usa el mismo rol que la local).
run_pg_dump "$OUT"

# Verificación: si el archivo está corrupto, pg_restore --list falla.
if ! run_pg_restore_list "$OUT" >/dev/null 2>&1; then
  echo "✗ El respaldo quedó ilegible. Se elimina para no dar falsa seguridad." >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
TABLES="$(run_pg_restore_list "$OUT" | grep -c 'TABLE DATA' || true)"
echo "✓ Respaldo verificado: $SIZE · $TABLES tablas con datos"

# Suma de verificación, para detectar corrupción silenciosa más adelante.
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT" | awk '{print $1}' > "$OUT.sha256"
  echo "  SHA-256 en $(basename "$OUT").sha256"
fi

# Rotación por antigüedad.
DELETED="$(find "$BACKUP_DIR" -name '*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')"
find "$BACKUP_DIR" -name '*.dump.sha256' -type f -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
[[ "$DELETED" -gt 0 ]] && echo "  Rotación: $DELETED respaldo(s) de más de $RETENTION_DAYS días eliminados"

echo
echo "Respaldos disponibles:"
ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null | awk '{print "  " $9 "  " $5}' || echo "  (ninguno)"
echo
echo "⚠ Este respaldo contiene datos personales: aplica la Ley 1581 de 2012."
echo "  No lo subas al repositorio (/backups está en .gitignore) ni a un"
echo "  almacenamiento sin cifrado. Ver docs/runbooks/backup-recovery.md"
