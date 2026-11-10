#!/usr/bin/env bash
#
# Restauración de la base de datos de Reverde.
#
#   npm run db:restore                        # usa el respaldo más reciente
#   npm run db:restore -- backups/x.dump      # un archivo concreto
#   TARGET_DATABASE_URL=… npm run db:restore  # restaurar en otra base
#
# ⚠ OPERACIÓN DESTRUCTIVA: reemplaza el contenido de la base de destino.
# Por eso exige confirmación escrita, y se niega a correr contra una base
# que parezca de producción salvo que se pase I_UNDERSTAND_THIS_IS_PRODUCTION=yes.
#
# Procedimiento de recuperación, RTO/RPO y prueba de restauración:
# docs/runbooks/backup-recovery.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    for f in "$ROOT/.env.local" "$ROOT/.env" "$ROOT/.env.development"; do
      if [[ -f "$f" ]]; then
        # shellcheck disable=SC2046
        export $(grep -E '^DATABASE_URL=' "$f" | tail -1 | xargs -0 echo) 2>/dev/null || true
        [[ -n "${DATABASE_URL:-}" ]] && break
      fi
    done
  fi
  TARGET_DATABASE_URL="${DATABASE_URL:-}"
fi

if [[ -z "$TARGET_DATABASE_URL" ]]; then
  echo "✗ No hay base de destino. Define TARGET_DATABASE_URL o DATABASE_URL." >&2
  exit 1
fi

# Archivo a restaurar: el indicado, o el más reciente del directorio.
DUMP="${1:-}"
if [[ -z "$DUMP" ]]; then
  DUMP="$(ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
fi
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "✗ No se encontró ningún respaldo en $BACKUP_DIR" >&2
  echo "  Genera uno con: npm run db:backup" >&2
  exit 1
fi

# Igual que en el respaldo: binario del sistema, o el del contenedor local.
RESTORE_MODE=""
if command -v pg_restore >/dev/null 2>&1; then
  RESTORE_MODE="local"
elif command -v docker >/dev/null 2>&1 && docker compose ps db --status running 2>/dev/null | grep -q db; then
  RESTORE_MODE="docker"
  echo "ℹ pg_restore no está en el sistema: se usa el del contenedor «db»."
else
  echo "✗ No hay forma de ejecutar pg_restore." >&2
  echo "  Instálalo (macOS: brew install libpq) o levanta la base: npm run db:up" >&2
  exit 1
fi

PG_CONTAINER_USER="${PG_CONTAINER_USER:-reverde}"
PG_CONTAINER_DB="${PG_CONTAINER_DB:-reverde_dev}"

run_restore_list() {
  if [[ "$RESTORE_MODE" == "local" ]]; then
    pg_restore --list "$1"
  else
    docker compose exec -T db pg_restore --list < "$1"
  fi
}

run_restore() {
  if [[ "$RESTORE_MODE" == "local" ]]; then
    pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists \
      --no-owner --no-privileges --single-transaction "$1"
  else
    docker compose exec -T db pg_restore \
      --username="$PG_CONTAINER_USER" --dbname="$PG_CONTAINER_DB" \
      --clean --if-exists --no-owner --no-privileges --single-transaction < "$1"
  fi
}

DB_NAME="$(printf '%s' "$TARGET_DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
DB_HOST="$(printf '%s' "$TARGET_DATABASE_URL" | sed -E 's#.*@([^:/?]+).*#\1#')"

# Barrera contra restaurar encima de producción por accidente.
if [[ "$DB_NAME" == *prod* || "$DB_HOST" != "localhost" && "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "db" ]]; then
  if [[ "${I_UNDERSTAND_THIS_IS_PRODUCTION:-no}" != "yes" ]]; then
    echo "✗ El destino «$DB_NAME» en «$DB_HOST» no parece una base local." >&2
    echo "  Restaurar ahí borraría datos reales. Si es a propósito:" >&2
    echo "  I_UNDERSTAND_THIS_IS_PRODUCTION=yes npm run db:restore -- $DUMP" >&2
    exit 1
  fi
  echo "⚠ Restaurando en un destino REMOTO: $DB_NAME @ $DB_HOST"
fi

# Verifica la integridad antes de tocar nada.
if ! run_restore_list "$DUMP" >/dev/null 2>&1; then
  echo "✗ El respaldo está corrupto o no es un volcado en formato personalizado." >&2
  exit 1
fi
if [[ -f "$DUMP.sha256" ]] && command -v shasum >/dev/null 2>&1; then
  if shasum -a 256 -c "$DUMP.sha256" >/dev/null 2>&1; then
    echo "✓ Suma de verificación correcta"
  else
    echo "✗ La suma de verificación NO coincide: el archivo cambió desde el respaldo." >&2
    exit 1
  fi
fi

echo
echo "  Respaldo : $DUMP ($(du -h "$DUMP" | cut -f1), $(date -r "$DUMP" '+%Y-%m-%d %H:%M'))"
echo "  Destino  : $DB_NAME @ $DB_HOST"
echo
echo "⚠ Se eliminará el contenido actual de «$DB_NAME» y se reemplazará."
printf 'Escribe «restaurar» para continuar: '
read -r CONFIRM
[[ "$CONFIRM" == "restaurar" ]] || { echo "Cancelado."; exit 1; }

echo "→ Restaurando…"
# --clean --if-exists borra los objetos antes de recrearlos; --single-transaction
# hace que un fallo a mitad no deje la base en un estado intermedio.
run_restore "$DUMP"

echo "✓ Restauración terminada"
echo
echo "Siguiente paso obligatorio: verificar."
echo "  npm run db:deploy       # aplica migraciones pendientes"
echo "  curl -s localhost:4000/api/health | jq"
echo "  npm run db:studio       # revisar que los datos están"
echo
echo "Registra el resultado en la tabla de pruebas de restauración de"
echo "docs/runbooks/backup-recovery.md (una restauración sin registrar no cuenta)."
