import { defineConfig } from 'vitest/config';

import { TEST_ENV } from './src/tests/testEnv.ts';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/globalSetup.ts'],
    // Todas las pruebas comparten una base de datos: se ejecutan en serie para
    // que el estado de cada caso sea predecible.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    /**
     * Configuración exclusiva de pruebas (ver src/tests/testEnv.ts). Nunca
     * toca la base de desarrollo: `env.ts` usa TEST_DATABASE_URL con
     * NODE_ENV=test.
     */
    env: TEST_ENV,
    coverage: {
      provider: 'v8',
      reportsDirectory: '../coverage/api',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/domain/**', 'src/lib/**', 'src/middleware/**', 'src/modules/**'],
      exclude: ['src/modules/dev.ts', 'src/openapi.ts'],
      /**
       * Sin umbral obligatorio todavía, a propósito: esta suite necesita
       * PostgreSQL, así que su cobertura solo se puede medir donde haya base de
       * datos (la CI). El umbral que SÍ bloquea está en `vitest.unit.config.ts`
       * (lógica pura de la API) y en el `vitest.config.ts` de la raíz
       * (frontend). Cuando la CI haya reportado una cifra estable varias veces,
       * fijar aquí el umbral en ese valor menos un margen.
       * Ver docs/qa/interfaz.md § cobertura.
       */
    },
  },
});
