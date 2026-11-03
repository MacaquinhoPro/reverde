import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuración de pruebas unitarias / de integración (jsdom).
 * Las pruebas de carga viven en `vitest.load.config.ts` y las de QA en Playwright.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/hooks/**', 'src/store/**', 'src/data/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
