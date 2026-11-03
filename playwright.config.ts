import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.QA_PORT ?? 5174);
const BASE_URL = process.env.QA_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Pruebas de QA de Reverde: recorren la aplicación real en un navegador,
 * siguiendo los flujos del guion de sustentación (administrador, cliente,
 * superadmin) y la capa legal de habeas data.
 *
 * `QA_BASE_URL=https://… npx playwright test` corre la misma suite contra un
 * despliegue en vez del servidor local.
 */
export default defineConfig({
  testDir: './tests/qa',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'móvil', use: { ...devices['Pixel 7'] } },
  ],

  // Contra un despliegue externo no se levanta nada local.
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
