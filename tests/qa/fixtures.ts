import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { Role } from '../../src/types';

/** Debe coincidir con `LEGAL_VERSION` en `src/data/legal.ts`. */
export const LEGAL_VERSION = '1.0';

const CONSENT_KEY = 'reverde.legal.consent';
const DEMO_PREFIX = 'reverde.v1.';

export const CUENTAS: Record<Role, { email: string; nombre: string; home: string }> = {
  supermercado: { email: 'supermercado1@reverde.com', nombre: 'Laura Mendoza', home: '/app/inicio' },
  restaurante: { email: 'restaurante1@reverde.com', nombre: 'Camilo Prieto', home: '/app/inicio' },
  cliente: { email: 'cliente1@reverde.com', nombre: 'Sofía Herrera', home: '/tienda' },
  superadmin: { email: 'admin1@reverde.com', nombre: 'Equipo Reverde', home: '/admin/inicio' },
};

export const DEMO_PASSWORD = 'Demo1234';

/** Autorización de habeas data ya otorgada, para no cruzar el gate en cada prueba. */
export const consentRecord = () => ({
  version: LEGAL_VERSION,
  acceptedAt: new Date().toISOString(),
  terms: true,
  dataProcessing: true,
  marketing: false,
  evidence: { userAgent: 'playwright', language: 'es-CO', path: '/' },
  log: [{ at: new Date().toISOString(), action: 'otorgado', detail: 'QA', version: LEGAL_VERSION }],
});

type Fixtures = {
  /** Si es `false`, la prueba arranca sin autorización y verá el gate legal. */
  conConsentimiento: boolean;
  /** Errores de consola recogidos durante la prueba. */
  erroresDeConsola: string[];
};

export const test = base.extend<Fixtures>({
  conConsentimiento: [true, { option: true }],

  page: async ({ page, conConsentimiento }, use) => {
    if (conConsentimiento) {
      await page.addInitScript((payload) => {
        try {
          window.localStorage.setItem('reverde.legal.consent', payload);
        } catch {
          /* almacenamiento no disponible */
        }
      }, JSON.stringify(consentRecord()));
    }
    await use(page);
  },

  erroresDeConsola: async ({ page }, use) => {
    const errores: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errores.push(msg.text());
    });
    page.on('pageerror', (err) => errores.push(err.message));
    await use(errores);
  },
});

export { expect };

/**
 * Varias pantallas renderizan el mismo dato dos veces —una tabla para
 * escritorio (`hidden lg:block`) y tarjetas para móvil (`lg:hidden`)—, así que
 * un `.first()` a secas puede caer en el nodo oculto. Este ayudante se queda
 * solo con lo que el usuario realmente ve, y sirve igual en ambos proyectos.
 */
export const visible = (locator: Locator): Locator => locator.filter({ visible: true });

/** Texto visible en la pantalla, sin importar si el layout es tabla o tarjetas. */
export const textoVisible = (page: Page, texto: string | RegExp): Locator =>
  visible(page.getByText(texto)).first();

/** Entra con una cuenta demo usando los accesos rápidos del login. */
export async function entrarComo(page: Page, role: Role): Promise<void> {
  const cuenta = CUENTAS[role];
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(cuenta.nombre.split(' ')[0] + '|' + role, 'i') }).first().click();
  await page.waitForURL(new RegExp(cuenta.home.replace(/\//g, '\\/')));
}

/**
 * Entra escribiendo el formulario, para probar la autenticación en sí.
 *
 * Nota de QA: `Field` renderiza un `<label>` sin `htmlFor` y el input como
 * hermano, así que los campos de texto no tienen etiqueta asociada y
 * `getByLabel` no los encuentra. Ver «Hallazgos abiertos» en docs/QA-PLAN.md.
 * Hasta que se corrija, se localizan por placeholder y por tipo.
 */
export async function entrarConFormulario(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@reverde.com').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/** Deja la demo en su estado inicial (sin borrar la autorización legal). */
export async function reiniciarDatos(page: Page): Promise<void> {
  await page.evaluate((prefix) => {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => window.localStorage.removeItem(k));
  }, DEMO_PREFIX);
}

/** Quita la autorización legal para volver a ver el gate. */
export async function revocarConsentimiento(page: Page): Promise<void> {
  await page.evaluate((key) => window.localStorage.removeItem(key), CONSENT_KEY);
}

/** Errores de consola que no indican un fallo de la app. */
export const RUIDO_DE_CONSOLA = [
  /favicon/i,
  /Failed to load resource.*\/img\//i,  // fotos de productos ausentes en el repo
  /ERR_CONNECTION/i,
  /Download the React DevTools/i,
];

export const erroresReales = (errores: string[]): string[] =>
  errores.filter((e) => !RUIDO_DE_CONSOLA.some((r) => r.test(e)));
