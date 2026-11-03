import { entrarComo, erroresReales, expect, test } from './fixtures';

/**
 * QA de la capa legal (Ley 1581 de 2012): nadie debe poder usar la plataforma
 * sin haber autorizado el tratamiento de sus datos, y la autorización debe
 * quedar registrada con su versión y fecha.
 */
test.describe('autorización de tratamiento de datos', () => {
  test.use({ conConsentimiento: false });

  test('el gate bloquea la aplicación en la primera visita', async ({ page }) => {
    await page.goto('/login');
    const dialogo = page.getByRole('dialog', { name: /Autorización de tratamiento de datos/i });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText('Protección de datos personales')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Autorizo y continúo' })).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'No autorizo' })).toBeVisible();
  });

  test('la portada y el centro legal se pueden leer sin autorizar nada', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/legal/privacidad');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/tratamiento de datos/i);
  });

  test('no autorizar deja una salida clara y permite reconsiderar', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'No autorizo' }).click();
    await expect(page.getByText('No registramos tu autorización')).toBeVisible();

    await page.getByRole('button', { name: /Volver|Revisar|Autoriz/i }).first().click();
    await expect(page.getByRole('button', { name: 'Autorizo y continúo' })).toBeVisible();
  });

  test('exige las dos casillas obligatorias antes de continuar', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Autorizo y continúo' }).click();
    // Sin marcar nada, el gate sigue ahí.
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('autorizar desbloquea la app y queda registrado con versión y fecha', async ({ page }) => {
    await page.goto('/login');
    const dialogo = page.getByRole('dialog');
    const casillas = dialogo.locator('input[type="checkbox"]');
    await casillas.nth(0).check();
    await casillas.nth(1).check();
    await dialogo.getByRole('button', { name: 'Autorizo y continúo' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ingresa a Reverde' })).toBeVisible();

    const registro = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.legal.consent') ?? 'null'),
    );
    expect(registro).toMatchObject({ terms: true, dataProcessing: true, version: '1.0' });
    expect(Number.isNaN(new Date(registro.acceptedAt).getTime())).toBe(false);
    expect(registro.log.at(-1)).toMatchObject({ action: 'otorgado' });
  });

  test('la autorización sobrevive a recargar la página', async ({ page }) => {
    await page.goto('/login');
    const casillas = page.getByRole('dialog').locator('input[type="checkbox"]');
    await casillas.nth(0).check();
    await casillas.nth(1).check();
    await page.getByRole('button', { name: 'Autorizo y continúo' }).click();

    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('el texto completo de la autorización se puede leer antes de aceptar', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Leer el texto completo/i }).click();
    await expect(page.getByRole('dialog')).toContainText(/finalidad|titular|derechos/i);
  });
});

test.describe('consentimiento del pedido', () => {
  test('el checkout exige autorización específica para el pedido', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await expect(page.getByText('Agregado al carrito')).toBeVisible();

    await page.goto('/tienda/carrito');
    await page.getByRole('button', { name: 'Continuar a la compra' }).click();
    await expect(page).toHaveURL(/\/tienda\/checkout/);

    // Sin la casilla de autorización el pago está bloqueado.
    const pagar = page.getByRole('button', { name: /^Pagar \$/ });
    await expect(pagar).toBeDisabled();

    await page.getByRole('checkbox', { name: /Autorizo a Reverde a tratar mis datos/i }).check();
    await expect(pagar).toBeEnabled();
    await pagar.click();
    await expect(page).toHaveURL(/\/tienda\/confirmacion\//, { timeout: 15_000 });

    const pedido = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.orders') ?? '[]')[0],
    );
    expect(pedido.consent).toMatchObject({ version: '1.0' });
    expect(pedido.consent.purpose).toContain('pedido');
  });

  test('la consola no reporta errores durante el flujo legal', async ({ page, erroresDeConsola }) => {
    await page.goto('/legal');
    await page.goto('/legal/terminos');
    await page.goto('/legal/privacidad');
    expect(erroresReales(erroresDeConsola)).toEqual([]);
  });
});
