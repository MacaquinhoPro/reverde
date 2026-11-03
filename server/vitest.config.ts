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
  },
});
