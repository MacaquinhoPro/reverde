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
    // Un único hilo y sin paralelismo entre archivos: así las mediciones son
    // comparables entre corridas.
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    reporters: ['verbose'],
  },
});
