import { defineConfig } from 'vitest/config';

/**
 * Pruebas de carga del motor de IA en el cliente: el Risk Score se recalcula
 * en cada render, así que su coste con inventarios grandes es el verdadero
 * límite de escala de la app. Presupuestos de tiempo explícitos y un único
 * hilo para que las mediciones sean comparables entre corridas.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/load/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true, minThreads: 1, maxThreads: 1 } },
    reporters: ['verbose'],
  },
});
