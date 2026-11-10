#!/usr/bin/env bash
#
# Prueba de restauración automática: respalda, destruye, restaura y comprueba
# que los datos volvieron exactamente iguales.
#
#   npm run db:verify-backup
#   DATABASE_URL=… npm run db:verify-backup
#
# ⚠ DESTRUCTIVA POR DISEÑO: borra filas de la base de destino y luego las
# repone desde el respaldo. Por eso solo corre contra una base local o de
# pruebas, nunca contra algo que parezca producción.
#
# Esto es lo que convierte el respaldo en un «sistema funcionando»: un script
# que nadie ha probado restaurando no es un respaldo, es un archivo. Corre en
# la integración continua con cada cambio (trabajo `respaldo` de ci.yml) y
# cualquiera puede ejecutarlo en local con la base de desarrollo levantada.
#
# Procedimiento manual, RTO/RPO y registro: docs/runbooks/backup-recovery.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Base de destino ──────────────────────────────────────────────────────
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
  echo "✗ DATABASE_URL no está definida." >&2
  exit 1
fi
export DATABASE_URL

DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
DB_HOST="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*@([^:/?]+).*#\1#')"

# ── Barrera: esta prueba BORRA datos ─────────────────────────────────────
if [[ "${DB_NAME}" == *prod* ]] ||
   { [[ "${DB_HOST}" != "localhost" ]] && [[ "${DB_HOST}" != "127.0.0.1" ]] && [[ "${DB_HOST}" != "db" ]]; }; then
  echo "✗ «${DB_NAME}» en «${DB_HOST}» no parece una base local o de pruebas." >&2
  echo "  Esta prueba borra filas: no se ejecuta contra bases remotas." >&2
  exit 1
fi

# ── Cómo hablar con PostgreSQL ───────────────────────────────────────────
if command -v psql >/dev/null 2>&1; then
  psql_q() { psql --dbname="$DATABASE_URL" -At -F'|' -c "$1"; }
elif command -v docker >/dev/null 2>&1 && docker compose ps db --status running 2>/dev/null | grep -q db; then
  psql_q() { docker compose exec -T db psql -U "${PG_CONTAINER_USER:-reverde}" -d "${PG_CONTAINER_DB:-reverde_dev}" -At -F'|' -c "$1"; }
else
  echo "✗ No hay psql disponible. Instálalo o levanta la base: npm run db:up" >&2
  exit 1
fi

# Tablas con datos que importan: si alguna no vuelve igual, la prueba falla.
CONTEO='
SELECT '"'"'Establishment'"'"' t, count(*) n FROM "Establishment"
UNION ALL SELECT '"'"'ExpirationAlert'"'"', count(*) FROM "ExpirationAlert"
UNION ALL SELECT '"'"'Permission'"'"', count(*) FROM "Permission"
UNION ALL SELECT '"'"'Product'"'"', count(*) FROM "Product"
UNION ALL SELECT '"'"'PromoOutcome'"'"', count(*) FROM "PromoOutcome"
UNION ALL SELECT '"'"'Recommendation'"'"', count(*) FROM "Recommendation"
UNION ALL SELECT '"'"'Sale'"'"', count(*) FROM "Sale"
UNION ALL SELECT '"'"'User'"'"', count(*) FROM "User"
ORDER BY 1'

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "══ Prueba de restauración · ${DB_NAME} @ ${DB_HOST} ══"
echo

# ── 1 · Estado inicial ───────────────────────────────────────────────────
psql_q "$CONTEO" > "$TMP/antes.txt"
FILAS_ANTES="$(awk -F'|' '{s+=$2} END {print s}' "$TMP/antes.txt")"
echo "1 · Estado inicial: ${FILAS_ANTES} filas en 8 tablas"
if [[ "${FILAS_ANTES:-0}" -eq 0 ]]; then
  echo "✗ La base está vacía: la prueba no demostraría nada. Siembra primero:" >&2
  echo "  npm run db:seed" >&2
  exit 1
fi

# ── 2 · Respaldo ─────────────────────────────────────────────────────────
echo "2 · Respaldando…"
BACKUP_DIR="$TMP/backups" bash scripts/db-backup.sh | sed 's/^/    /'
DUMP="$(ls -t "$TMP/backups"/*.dump | head -1)"

# ── 3 · Desastre simulado ────────────────────────────────────────────────
echo "3 · Simulando la pérdida de datos…"
psql_q 'DELETE FROM "Recommendation"; DELETE FROM "ExpirationAlert"; DELETE FROM "PromoOutcome"; DELETE FROM "Sale";' >/dev/null
FILAS_ROTAS="$(psql_q "$CONTEO" | awk -F'|' '{s+=$2} END {print s}')"
echo "    quedan ${FILAS_ROTAS} filas (se perdieron $((FILAS_ANTES - FILAS_ROTAS)))"
if [[ "$FILAS_ROTAS" -eq "$FILAS_ANTES" ]]; then
  echo "✗ No se borró nada: la prueba sería un falso positivo." >&2
  exit 1
fi

# ── 4 · Restauración ─────────────────────────────────────────────────────
echo "4 · Restaurando desde el respaldo…"
INICIO="$(date +%s)"
echo restaurar | TARGET_DATABASE_URL="$DATABASE_URL" bash scripts/db-restore.sh "$DUMP" | sed 's/^/    /'
SEGUNDOS="$(( $(date +%s) - INICIO ))"

# ── 5 · Comparación ──────────────────────────────────────────────────────
psql_q "$CONTEO" > "$TMP/despues.txt"
echo
echo "5 · Comparación tabla por tabla:"
printf '    %-18s %8s %8s\n' 'tabla' 'antes' 'después'
paste -d'|' "$TMP/antes.txt" "$TMP/despues.txt" |
  awk -F'|' '{printf "    %-18s %8s %8s  %s\n", $1, $2, $4, ($2==$4 ? "✓" : "✗")}'
echo

if diff -q "$TMP/antes.txt" "$TMP/despues.txt" >/dev/null; then
  echo "✅ Restauración íntegra: ${FILAS_ANTES} filas recuperadas en ${SEGUNDOS} s."
  echo "   Registra la corrida en docs/runbooks/backup-recovery.md"
  exit 0
fi

echo "❌ La restauración NO devolvió los mismos datos." >&2
diff "$TMP/antes.txt" "$TMP/despues.txt" >&2 || true
exit 1
