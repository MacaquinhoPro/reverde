/**
 * Compara las rutas registradas en el código con las documentadas en
 * `docs/arquitectura/openapi.json` y falla si alguna quedó sin documentar.
 *
 *   node scripts/check-openapi-drift.mjs
 *
 * La especificación solo sirve si refleja la realidad: sin esta comprobación,
 * la deriva no se nota hasta que alguien integra y falla.
 *
 * Para excluir un endpoint a propósito (simuladores, utilidades de
 * desarrollo), añádelo a ALLOWED_UNDOCUMENTED con el motivo.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MODULES = resolve(ROOT, 'server/src/modules');
const SPEC = resolve(ROOT, 'docs/arquitectura/openapi.json');

/** Prefijo con el que `app.ts` monta cada router. */
const MOUNT = {
  auth: '/api/auth',
  users: '/api/users',
  establishments: '/api/establishments',
  products: '/api/products',
  inventory: '/api/inventory',
  alerts: '/api/alerts',
  recommendations: '/api/recommendations',
  marketplace: '/api/marketplace',
  cart: '/api/cart',
  orders: '/api/orders',
  payments: '/api/payments',
  dashboard: '/api/dashboard',
  admin: '/api/admin',
  notifications: '/api/notifications',
};

/** Endpoints que NO se documentan a propósito, con el motivo. */
const ALLOWED_UNDOCUMENTED = new Map([
  ['GET /api/payments/mock/checkout', 'simulador de pagos, solo fuera de producción'],
  ['POST /api/payments/mock/simulate', 'simulador de pagos, solo fuera de producción'],
]);

if (!existsSync(SPEC)) {
  console.error(`No existe ${SPEC}. Genéralo con: npm run docs:openapi`);
  process.exit(1);
}

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
const documented = new Set();
for (const [path, ops] of Object.entries(spec.paths ?? {})) {
  for (const method of Object.keys(ops)) documented.add(`${method.toUpperCase()} ${path}`);
}

const registered = new Set();
for (const mod of readdirSync(MODULES, { withFileTypes: true })) {
  if (!mod.isDirectory()) continue;
  const file = resolve(MODULES, mod.name, 'routes.ts');
  if (!existsSync(file)) continue;
  const src = readFileSync(file, 'utf8');
  const mount = MOUNT[mod.name] ?? `/api/${mod.name}`;
  // Capta tanto `router.get('/x', …)` como la forma multilínea.
  for (const m of src.matchAll(/Router\s*\.\s*(get|post|patch|put|delete)\s*\(\s*(?:\n\s*)?'([^']*)'/g)) {
    const method = m[1].toUpperCase();
    // `:id` del estilo de Express → `{id}` del estilo de OpenAPI.
    const path = `${mount}${m[2]}`.replace(/\/{2,}/g, '/').replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') || mount;
    registered.add(`${method} ${path}`);
  }
}

const missing = [...registered].filter((r) => !documented.has(r) && !ALLOWED_UNDOCUMENTED.has(r)).sort();
const excluded = [...registered].filter((r) => ALLOWED_UNDOCUMENTED.has(r)).sort();
/** `/api/health` vive en app.ts, no en un módulo: no es deriva. */
const IN_APP_TS = new Set(['GET /api/health']);
const orphan = [...documented].filter((d) => !registered.has(d) && !IN_APP_TS.has(d)).sort();

console.log(`Rutas en el código: ${registered.size} · documentadas: ${documented.size}`);
if (excluded.length) {
  console.log(`\nExcluidas a propósito (${excluded.length}):`);
  for (const e of excluded) console.log(`  · ${e} — ${ALLOWED_UNDOCUMENTED.get(e)}`);
}
if (orphan.length) {
  console.log(`\n⚠ Documentadas pero no encontradas en el código (${orphan.length}):`);
  for (const o of orphan) console.log(`  · ${o}`);
}
if (missing.length) {
  console.error(`\n✗ ${missing.length} endpoint(s) sin documentar en openapi.json:`);
  for (const m of missing) console.error(`  · ${m}`);
  console.error('\nDocumenta la ruta en server/src/openapi.ts y corre: npm run docs:openapi');
  process.exit(1);
}
console.log('\n✓ Sin deriva: toda ruta registrada está documentada.');
