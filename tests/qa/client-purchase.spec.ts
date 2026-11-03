import { entrarComo, erroresReales, expect, test, textoVisible } from './fixtures';

/**
 * Flujo del comprador del guion de sustentación: explorar → ficha del producto
 * → carrito → checkout → compra confirmada, y la vuelta al panel del
 * establecimiento para ver la venta reflejada.
 */
test.describe('marketplace del cliente', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'cliente');
  });

  test('el inicio saluda al cliente y ofrece productos', async ({ page }) => {
    await expect(page).toHaveURL(/\/tienda/);
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('explorar lista publicaciones con precio, descuento e impacto', async ({ page }) => {
    await page.goto('/tienda/explorar');
    const tarjeta = page.locator('article').first();
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.getByText(/^\$/).first()).toBeVisible();
    await expect(tarjeta.getByText(/Evitas .* de desperdicio/)).toBeVisible();
    await expect(tarjeta.getByText(/Vence/)).toBeVisible();
  });

  test('la búsqueda filtra el catálogo', async ({ page }) => {
    await page.goto('/tienda/explorar');
    const total = await page.locator('article').count();
    await page.getByPlaceholder(/Buscar producto, categoría o establecimiento/i).fill('pan');
    await expect(page.locator('article')).not.toHaveCount(total);
    expect(await page.locator('article').count()).toBeGreaterThan(0);
  });

  test('una búsqueda sin resultados lo dice en lugar de mostrar una página vacía', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.getByPlaceholder(/Buscar producto, categoría o establecimiento/i).fill('zzzzz-no-existe');
    await expect(page.getByText('No encontramos productos')).toBeVisible();
  });

  test('el mapa simulado muestra los establecimientos', async ({ page }) => {
    await page.goto('/tienda/mapa');
    await expect(textoVisible(page, /Supermercado Verde|Cocina Raíz/)).toBeVisible();
  });

  test('la ficha del producto explica el ahorro y el impacto', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().locator('h3 a, a h3').first().click()
      .catch(async () => { await page.locator('article').first().getByRole('link').first().click(); });

    await expect(page).toHaveURL(/\/tienda\/producto\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comprar ahora' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reservar' })).toBeVisible();
    await expect(page.getByText('Tu impacto')).toBeVisible();
  });
});

test.describe('compra completa', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, 'cliente');
  });

  test('agregar al carrito actualiza el contador', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await expect(page.getByText('Agregado al carrito')).toBeVisible();

    await page.goto('/tienda/carrito');
    await expect(page.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
    await expect(page.getByText(/Ahorraste/)).toBeVisible();
    await expect(page.getByText(/Alimentos rescatados/)).toBeVisible();
  });

  test('el carrito respeta el stock disponible', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await page.goto('/tienda/carrito');

    const aumentar = page.getByRole('button', { name: 'Aumentar' }).first();
    for (let i = 0; i < 60 && (await aumentar.isEnabled()); i++) await aumentar.click();

    await expect(aumentar).toBeDisabled();
    await expect(page.getByText('Es todo el stock disponible de este producto.')).toBeVisible();
  });

  test('quitar el último producto deja el carrito vacío con una salida', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await page.goto('/tienda/carrito');
    await page.getByRole('button', { name: 'Quitar del carrito' }).first().click();

    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explorar marketplace' })).toBeVisible();
  });

  test('compra con tarjeta: termina en confirmación con código, ahorro e impacto', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await page.goto('/tienda/carrito');
    await page.getByRole('button', { name: 'Continuar a la compra' }).click();

    await expect(page.getByRole('heading', { name: 'Finalizar pedido' })).toBeVisible();
    await page.getByRole('checkbox', { name: /Autorizo a Reverde a tratar mis datos/i }).check();
    await page.getByRole('button', { name: /^Pagar \$/ }).click();

    await expect(page).toHaveURL(/\/tienda\/confirmacion\/.+/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible();
    await expect(page.getByText(/^RV-[A-Z0-9]{5}$/)).toBeVisible();
    await expect(page.getByText(/Código de compra/i)).toBeVisible();

    // El carrito queda limpio después de pagar.
    await page.goto('/tienda/carrito');
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
  });

  test('reserva: queda apartada para pagar en el local', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await page.goto('/tienda/carrito');
    await page.getByRole('button', { name: 'Reservar y pagar en el local' }).click();

    await expect(page.getByText('Pagarás en el local')).toBeVisible();
    await page.getByRole('checkbox', { name: /Autorizo a Reverde a tratar mis datos/i }).check();
    await page.getByRole('button', { name: 'Confirmar reserva' }).click();

    await expect(page).toHaveURL(/\/tienda\/confirmacion\/.+/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reserva confirmada' })).toBeVisible();
  });

  test('el perfil acumula los pedidos y el ahorro del cliente', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await page.goto('/tienda/carrito');
    await page.getByRole('button', { name: 'Continuar a la compra' }).click();
    await page.getByRole('checkbox', { name: /Autorizo a Reverde a tratar mis datos/i }).check();
    await page.getByRole('button', { name: /^Pagar \$/ }).click();
    await expect(page).toHaveURL(/\/tienda\/confirmacion\/.+/, { timeout: 15_000 });

    await page.goto('/tienda/perfil');
    await expect(page.getByRole('heading', { name: 'Sofía Herrera' })).toBeVisible();
    await expect(page.getByText('Mis pedidos y reservas')).toBeVisible();
    await expect(page.getByText('Todavía no tienes pedidos')).toHaveCount(0);
  });
});

test.describe('la compra se refleja en el establecimiento', () => {
  test('la venta del cliente aparece en el panel del supermercado', async ({ page }) => {
    // 1 · El cliente compra algo de Supermercado Verde.
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/explorar');
    await page.getByPlaceholder(/Buscar producto, categoría o establecimiento/i).fill('Supermercado Verde');
    const tarjeta = page.locator('article').first();
    await expect(tarjeta).toBeVisible();
    await tarjeta.getByRole('button', { name: /Agregar .* al carrito/i }).click();

    await page.goto('/tienda/carrito');
    await page.getByRole('button', { name: 'Continuar a la compra' }).click();
    await page.getByRole('checkbox', { name: /Autorizo a Reverde a tratar mis datos/i }).check();
    await page.getByRole('button', { name: /^Pagar \$/ }).click();
    await expect(page).toHaveURL(/\/tienda\/confirmacion\/.+/, { timeout: 15_000 });

    const ventasAntes = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.sales') ?? '[]')
        .filter((s: { establishmentId: string; channel: string }) => s.establishmentId === 'sup-1' && s.channel === 'marketplace').length,
    );
    expect(ventasAntes).toBeGreaterThan(0);

    // 2 · El administrador la ve en su historial de ventas.
    await entrarComo(page, 'supermercado');
    await page.goto('/app/ventas');
    await expect(textoVisible(page, 'Sofía Herrera')).toBeVisible();
  });

  test('el recorrido del cliente no deja errores en consola', async ({ page, erroresDeConsola }) => {
    await entrarComo(page, 'cliente');
    for (const ruta of ['/tienda', '/tienda/explorar', '/tienda/mapa', '/tienda/carrito', '/tienda/perfil']) {
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
    }
    expect(erroresReales(erroresDeConsola)).toEqual([]);
  });
});
