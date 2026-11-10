import { entrarComo, erroresReales, expect, reiniciarDatos, test, textoVisible, visible } from './fixtures';

test.describe('persistencia y enlaces profundos', () => {
  test('la sesión sobrevive a recargar la página', async ({ page }) => {
    await entrarComo(page, 'supermercado');
    await page.goto('/app/inventario');
    await page.reload();
    await expect(page).toHaveURL(/\/app\/inventario/);
    await expect(page.getByRole('heading', { name: 'Inventario', level: 2 })).toBeVisible();
  });

  test('el carrito sobrevive a recargar la página', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();
    await expect(page.getByText('Agregado al carrito')).toBeVisible();

    await page.reload();
    await page.goto('/tienda/carrito');
    await expect(visible(page.getByText('Tu carrito está vacío'))).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
  });

  test('un enlace profundo a un producto funciona al entrar directamente', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/explorar');
    const id = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.products') ?? '[]')
        .find((p: { status: string; quantity: number }) => p.status === 'publicado' && p.quantity > 0)?.id,
    );
    expect(id).toBeTruthy();

    await page.goto(`/tienda/producto/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible();
  });

  test('un producto inexistente no rompe la aplicación', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/producto/p-que-no-existe');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/no encontr|no existe|no disponible/i).first()).toBeVisible();
  });

  test('una confirmación inexistente no rompe la aplicación', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/confirmacion/o-que-no-existe');
    await expect(page.locator('main')).toBeVisible();
  });

  test('un JSON corrupto en localStorage no impide abrir la app', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('reverde.v1.products', '{esto no es json');
      window.localStorage.setItem('reverde.v1.sales', 'esto tampoco');
    });
    await page.goto('/tienda/explorar');
    await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
    await expect(page.locator('article').first()).toBeVisible();
  });

  /**
   * Regresión del hallazgo H-1 (docs/QA-PLAN.md), ya corregido.
   *
   * `null` guardado donde se espera una lista es JSON válido, así que `load()`
   * lo devolvía tal cual y `cart.reduce(...)` en `cartCount` lanzaba
   * «Cannot read properties of null (reading 'reduce')»: pantalla en blanco,
   * sin forma de recuperarse salvo limpiar el almacenamiento a mano.
   *
   * `load()` valida ahora la forma de lo leído, no solo que el JSON parsee.
   */
  test('un valor null en una lista de localStorage no debe tumbar la app', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.setItem('reverde.v1.cart', 'null'));
    await page.goto('/tienda/explorar');
    await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
  });
});

test.describe('reiniciar la demo', () => {
  test('restaura el inventario original desde el perfil', async ({ page }) => {
    await entrarComo(page, 'supermercado');

    // Se ensucia el estado: un descuento aplicado desde las alertas.
    await page.goto('/app/alertas');
    await page.getByRole('button', { name: /^Aplicar \d+ %$/ }).first().click();
    await expect(page.getByText('Recomendación aplicada')).toBeVisible();

    await entrarComo(page, 'cliente');
    await page.goto('/tienda/perfil');
    await page.getByRole('button', { name: /Reiniciar datos de la demo/i }).click();

    await expect(page.getByText('Demo reiniciada')).toBeVisible();
    const pedidos = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.orders') ?? '[]'),
    );
    expect(pedidos).toEqual([]);
  });

  test('reiniciar no borra la autorización de habeas data', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/perfil');
    await page.getByRole('button', { name: /Reiniciar datos de la demo/i }).click();
    await expect(page.getByText('Demo reiniciada')).toBeVisible();

    const consentimiento = await page.evaluate(() =>
      window.localStorage.getItem('reverde.legal.consent'),
    );
    expect(consentimiento).not.toBeNull();
    await expect(page.getByRole('dialog', { name: /Autorización de tratamiento/i })).toHaveCount(0);
  });

  test('con el almacenamiento vacío la demo se vuelve a sembrar sola', async ({ page }) => {
    await page.goto('/');
    await reiniciarDatos(page);
    await page.goto('/tienda/explorar');
    await expect(page.locator('article').first()).toBeVisible();

    const total = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.products') ?? '[]').length,
    );
    expect(total).toBeGreaterThan(40);
  });
});

test.describe('experiencia móvil', () => {
  test.skip(({ isMobile }) => !isMobile, 'solo aplica al proyecto móvil');

  test('la barra inferior permite navegar la tienda', async ({ page }) => {
    await entrarComo(page, 'cliente');
    for (const [etiqueta, url] of [
      ['Explorar', /\/tienda\/explorar/],
      ['Mapa', /\/tienda\/mapa/],
      ['Carrito', /\/tienda\/carrito/],
      ['Perfil', /\/tienda\/perfil/],
    ] as const) {
      await visible(page.getByRole('link', { name: etiqueta })).first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test('el panel del administrador es usable en móvil', async ({ page }) => {
    await entrarComo(page, 'supermercado');
    await page.goto('/app/inventario');
    // En móvil el inventario se muestra como tarjetas, no como tabla.
    await expect(visible(page.locator('table'))).toHaveCount(0);
    await expect(textoVisible(page, 'Yogur natural')).toBeVisible();
    await page.goto('/app/alertas');
    await expect(page.getByRole('heading', { name: 'Alertas inteligentes' })).toBeVisible();
  });

  test('los filtros del inventario se abren en un panel', async ({ page }) => {
    await entrarComo(page, 'supermercado');
    await page.goto('/app/inventario');
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await expect(textoVisible(page, 'Nivel de riesgo')).toBeVisible();
  });

  test('no hay desbordamiento horizontal en las pantallas principales', async ({ page }) => {
    await entrarComo(page, 'cliente');
    for (const ruta of ['/tienda', '/tienda/explorar', '/tienda/carrito', '/tienda/perfil']) {
      await page.goto(ruta);
      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      expect(desborda, `${ruta} desborda horizontalmente`).toBe(false);
    }
  });
});

test.describe('salud general', () => {
  test('ninguna pantalla pública deja errores en consola', async ({ page, erroresDeConsola }) => {
    for (const ruta of ['/', '/login', '/legal', '/tienda', '/tienda/explorar', '/tienda/mapa']) {
      await page.goto(ruta);
      await expect(page.locator('body')).toBeVisible();
    }
    expect(erroresReales(erroresDeConsola)).toEqual([]);
  });

  test('cada pantalla tiene un encabezado principal', async ({ page }) => {
    await entrarComo(page, 'cliente');
    for (const ruta of ['/tienda/explorar', '/tienda/carrito', '/tienda/perfil']) {
      await page.goto(ruta);
      await expect(page.getByRole('heading').first()).toBeVisible();
    }
  });
});
