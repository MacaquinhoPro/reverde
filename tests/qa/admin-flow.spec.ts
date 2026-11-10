import { entrarComo, erroresReales, expect, test, textoVisible, visible } from './fixtures';

/**
 * Recorre el flujo del administrador tal como está en el guion de sustentación:
 * KPIs → inventario → alerta de alto riesgo → explicabilidad → aplicar
 * descuento → publicar en el marketplace.
 */
test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'supermercado');
});

test.describe('panel del establecimiento', () => {
  test('el inicio muestra KPIs y el nombre del establecimiento', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/inicio/);
    await expect(textoVisible(page, 'Supermercado Verde')).toBeVisible();
    await expect(textoVisible(page, /Desperdicio evitado/i)).toBeVisible();
    await expect(textoVisible(page, /recuperad/i)).toBeVisible();
  });

  test('la navegación llega a todas las secciones', async ({ page }) => {
    for (const [etiqueta, encabezado] of [
      ['Inventario', 'Inventario'],
      ['Alertas IA', 'Alertas inteligentes'],
      ['Marketplace', 'Mis publicaciones'],
      ['Impacto', 'Impacto de Reverde'],
    ] as const) {
      // En escritorio es la barra lateral; en móvil la barra inferior.
      await visible(page.getByRole('link', { name: etiqueta, exact: false })).first().click();
      await expect(page.getByRole('heading', { name: encabezado }).first()).toBeVisible();
    }
  });

  test('el inventario lista productos con su nivel de riesgo', async ({ page }) => {
    await page.goto('/app/inventario');
    await expect(page.getByRole('heading', { name: 'Inventario', level: 2 })).toBeVisible();
    await expect(textoVisible(page, 'Yogur natural')).toBeVisible();
    await expect(textoVisible(page, /Alto riesgo/i)).toBeVisible();
  });

  test('el inventario se puede filtrar por nivel de riesgo', async ({ page, isMobile }) => {
    await page.goto('/app/inventario');

    // Se cuentan las insignias de riesgo visibles: funciona igual con la tabla
    // de escritorio y con las tarjetas de móvil.
    const altos = visible(page.getByText('Alto riesgo'));
    const medios = visible(page.getByText('Riesgo medio'));
    const bajos = visible(page.getByText('Bajo riesgo'));

    expect(await altos.count()).toBeGreaterThan(0);
    const antes = (await altos.count()) + (await medios.count()) + (await bajos.count());

    if (isMobile) {
      // En móvil los filtros viven en un panel desplegable.
      await page.getByRole('button', { name: /^Filtros/ }).click();
      await page.getByRole('combobox').nth(1).selectOption('alto');
      await page.getByRole('button', { name: /Ver|Aplicar|Cerrar|Listo/i }).last().click();
    } else {
      await page.getByRole('button', { name: 'Alto', exact: true }).click();
    }

    await expect(medios).toHaveCount(0);
    await expect(bajos).toHaveCount(0);
    expect(await altos.count()).toBeGreaterThan(0);
    expect(await altos.count()).toBeLessThan(antes);
  });

  test('la búsqueda del inventario encuentra un producto concreto', async ({ page }) => {
    await page.goto('/app/inventario');
    await page.getByPlaceholder(/Buscar producto/i).first().fill('yogur');
    await expect(textoVisible(page, /Yogur/i)).toBeVisible();
  });
});

test.describe('alertas y recomendaciones de IA', () => {
  test('las alertas se priorizan y se pueden filtrar por nivel', async ({ page }) => {
    await page.goto('/app/alertas');
    await expect(page.getByRole('heading', { name: 'Alertas inteligentes' })).toBeVisible();
    await expect(textoVisible(page, /Alto riesgo/i)).toBeVisible();

    await page.getByRole('button', { name: /^Alto \(\d+\)$/ }).click();
    await expect(visible(page.getByText('Riesgo medio'))).toHaveCount(0);
  });

  test('cada alerta explica por qué Reverde la recomienda', async ({ page }) => {
    await page.goto('/app/alertas');
    await page.getByRole('link', { name: 'Ver producto y análisis' }).first().click();
    await expect(page).toHaveURL(/\/app\/alertas\/.+/);

    // La explicabilidad viene desplegada: los cuatro factores del Risk Score
    // están a la vista sin tener que buscarlos.
    const explicacion = page.getByRole('button', { name: '¿Por qué recomendamos esto?' });
    await expect(explicacion).toBeVisible();
    for (const factor of [
      'Proximidad al vencimiento',
      'Stock frente al tiempo restante',
      'Rotación histórica',
      'Demanda de la última semana',
    ]) {
      await expect(page.getByText(factor, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/Risk Score = riesgo por vencimiento/)).toBeVisible();

    // Y se puede plegar y volver a desplegar.
    await explicacion.click();
    await expect(page.getByText('Proximidad al vencimiento', { exact: true })).toHaveCount(0);
    await explicacion.click();
    await expect(page.getByText('Proximidad al vencimiento', { exact: true })).toBeVisible();
  });

  test('aplicar el descuento recomendado baja el precio del producto', async ({ page }) => {
    await page.goto('/app/alertas');
    const boton = page.getByRole('button', { name: /^Aplicar \d+ %$/ }).first();
    const etiqueta = (await boton.textContent())!.trim();
    const porcentaje = Number(etiqueta.match(/\d+/)![0]);

    await boton.click();
    await expect(page.getByText('Recomendación aplicada')).toBeVisible();

    const productos = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.products') ?? '[]'),
    );
    expect(productos.some((p: { discountPercent: number }) => p.discountPercent === porcentaje)).toBe(true);
  });

  test('publicar desde la alerta lo hace visible en el marketplace del cliente', async ({ page }) => {
    await page.goto('/app/alertas');
    const publicar = page.getByRole('button', { name: 'Publicar' }).first();
    await publicar.click();
    await expect(page.getByText('Publicado en el marketplace')).toBeVisible();

    const publicados = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.products') ?? '[]')
        .filter((p: { status: string }) => p.status === 'publicado').length,
    );
    expect(publicados).toBeGreaterThan(0);
  });

  test('la ficha de recomendación muestra el aprendizaje del histórico', async ({ page }) => {
    await page.goto('/app/alertas');
    await page.getByRole('link', { name: 'Ver producto y análisis' }).first().click();
    await expect(page.getByText('Histórico de la categoría')).toBeVisible();
    await expect(page.getByText('Mejor descuento')).toBeVisible();
  });
});

test.describe('ventas e impacto', () => {
  test('el historial de ventas muestra movimientos de la demo', async ({ page }) => {
    await page.goto('/app/ventas');
    await expect(page.getByRole('heading', { name: 'Historial de ventas' })).toBeVisible();
    await expect(visible(page.getByText('Sin ventas en este periodo'))).toHaveCount(0);
  });

  test('impacto traduce los kilos a equivalencias ambientales', async ({ page }) => {
    await page.goto('/app/impacto');
    await expect(page.getByRole('heading', { name: 'Impacto de Reverde' })).toBeVisible();
    await expect(textoVisible(page, 'Impacto ambiental estimado')).toBeVisible();
    await expect(textoVisible(page, /CO/i)).toBeVisible();
    await expect(textoVisible(page, /litros|agua/i)).toBeVisible();
  });

  test('registrar un producto nuevo lo agrega al inventario', async ({ page }) => {
    await page.goto('/app/inventario');
    const antes = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.products') ?? '[]').length,
    );

    await page.getByRole('button', { name: /Registrar producto|Nuevo/i }).first().click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const crear = modal.getByRole('button', { name: 'Crear producto' });
    // El formulario arranca vacío: el botón solo se habilita con datos válidos.
    await expect(crear).toBeDisabled();

    await modal.getByPlaceholder('Ej. Yogur natural').fill('Arepas de queso QA');
    await modal.locator('input[type="number"]').first().fill('12');
    await expect(crear).toBeEnabled();
    await crear.click();

    await expect(page.getByText('Producto creado')).toBeVisible();
    const despues = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('reverde.v1.products') ?? '[]').length,
    );
    expect(despues).toBe(antes + 1);
    await expect(textoVisible(page, 'Arepas de queso QA')).toBeVisible();
  });

  test('el recorrido completo no deja errores en consola', async ({ page, erroresDeConsola }) => {
    for (const ruta of ['/app/inicio', '/app/inventario', '/app/alertas', '/app/marketplace', '/app/ventas', '/app/impacto']) {
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
    }
    expect(erroresReales(erroresDeConsola)).toEqual([]);
  });
});
