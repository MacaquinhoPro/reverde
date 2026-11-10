import { defineConfig } from 'vitest/config';

import { TEST_ENV } from './src/tests/testEnv.ts';

/**
 * Pruebas de la API que **no necesitan base de datos**: lógica pura del
 * dominio y de las utilidades (Risk Score, contraseñas, cifrado, reintentos).
 *
 * Existe aparte de `vitest.config.ts` porque aquel usa `globalSetup` para
 * crear y sembrar la base de pruebas, lo que exige Docker. Estas corren en
 * cualquier máquina y en segundos, así que sirven de red de seguridad
 * mientras se programa y en la CI antes de levantar PostgreSQL.
 *
 *   npm run test:api:unit        (desde la raíz)
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/tests/{risk,password,retry}.test.ts'],
    env: TEST_ENV,
    coverage: {
      provider: 'v8',
      reportsDirectory: '../coverage/api-unit',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/domain/risk.ts', 'src/lib/password.ts', 'src/lib/crypto.ts', 'src/lib/retry.ts'],
      /**
       * Umbral de la lógica crítica sin base de datos. El objetivo del plan de
       * trabajo es ≥ 70 %; aquí se exige más porque es lógica pura y no hay
       * excusa para no cubrirla.
       */
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
