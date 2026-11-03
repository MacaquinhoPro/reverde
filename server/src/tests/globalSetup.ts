/**
 * Prepara la base de datos de pruebas una vez por corrida: aplica las
 * migraciones versionadas (las mismas que producción) y siembra el catálogo
 * de roles y permisos, que el control de acceso necesita para funcionar.
 *
 * No se usa `prisma migrate reset`: es destructivo. `migrate deploy` es
 * idempotente y los datos los limpia cada prueba con `resetDatabase()`.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { TEST_ENV } from './testEnv.ts';

export default function setup() {
  const cwd = resolve(import.meta.dirname, '../..');
  const env = { ...process.env, ...TEST_ENV };

  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
  // SEED_DEMO=false → solo permisos y roles; cada prueba crea sus propios datos.
  execSync('npx tsx prisma/seed.ts', { cwd, env: { ...env, SEED_DEMO: 'false' }, stdio: 'pipe' });
}
