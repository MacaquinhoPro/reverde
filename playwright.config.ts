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

  /**
   * Seis proyectos: los tres motores de navegador (Chromium, Firefox, WebKit)
   * en escritorio, y tres perfiles móviles reales.
   *
   * El motor importa más que la marca: Edge, Brave y Chrome comparten
   * Chromium, y Safari —el navegador de todo iPhone— es WebKit. Probar los
   * tres motores cubre el parque real sin multiplicar las corridas.
   *
   * Por defecto se corren los proyectos rápidos. Para la matriz completa:
   *   npm run test:qa:all                         (los seis)
   *   npx playwright test --project=webkit        (uno solo)
   *
   * Los navegadores se instalan una vez con: npx playwright install
   */
  projects: [
    // ── Escritorio: un proyecto por motor ───────────────────────────────
    {
      name: 'escritorio-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'escritorio-firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'escritorio-webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    // ── Móvil: el cliente usa la tienda casi solo desde el teléfono ─────
    { name: 'móvil-android', use: { ...devices['Pixel 7'] } },
    { name: 'móvil-ios', use: { ...devices['iPhone 14'] } },
    // Pantalla pequeña: el peor caso de layout que hay que soportar.
    {
      name: 'móvil-pequeño',
      use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 640 } },
    },
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
