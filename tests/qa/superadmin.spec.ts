import { entrarComo, erroresReales, expect, test, textoVisible, visible } from './fixtures';

test.beforeEach(async ({ page }) => {
  await entrarComo(page, 'superadmin');
});

test.describe('panel global del superadmin', () => {
  test('el resumen muestra el estado de toda la red', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/inicio/);
    await expect(page.getByRole('heading', { name: 'Panel global de Reverde' })).toBeVisible();
    await expect(page.getByText('Ranking de establecimientos')).toBeVisible();
    await expect(page.getByText('Desperdicio evitado en la red')).toBeVisible();
  });

  test('el listado de establecimientos incluye los seis de la demo', async ({ page }) => {
    await page.goto('/admin/establecimientos');
    await expect(page.getByRole('heading', { name: 'Establecimientos', level: 2 })).toBeVisible();
    for (const nombre of [
      'Supermercado Verde',
      'Mercado La Colina',
      'Fresco Market Usaquén',
      'Cocina Raíz',
      'Panadería El Trigal',
      'Bowl & Green',
    ]) {
      await expect(textoVisible(page, nombre)).toBeVisible();
    }
  });

  test('se puede buscar un establecimiento', async ({ page }) => {
    await page.goto('/admin/establecimientos');
    await page.getByPlaceholder(/Buscar/i).first().fill('Trigal');
    await expect(textoVisible(page, 'Panadería El Trigal')).toBeVisible();
    await expect(visible(page.getByText('Supermercado Verde'))).toHaveCount(0);
  });

  test('una búsqueda sin coincidencias lo informa', async ({ page }) => {
    await page.goto('/admin/establecimientos');
    await page.getByPlaceholder(/Buscar/i).first().fill('zzz-no-existe');
    await expect(page.getByText('Sin resultados')).toBeVisible();
  });

  test('el detalle de un establecimiento muestra inventario, impacto y ubicación', async ({ page }) => {
    await page.goto('/admin/establecimientos');
    await textoVisible(page, 'Supermercado Verde').click();

    await expect(page).toHaveURL(/\/admin\/establecimientos\/.+/);
    await expect(textoVisible(page, 'Inventario por nivel de riesgo')).toBeVisible();
    await expect(textoVisible(page, 'Publicaciones activas')).toBeVisible();
    await expect(textoVisible(page, 'Ubicación')).toBeVisible();
    await expect(textoVisible(page, 'Desperdicio evitado')).toBeVisible();
  });

  test('un establecimiento inexistente muestra un estado vacío con salida', async ({ page }) => {
    await page.goto('/admin/establecimientos/no-existe');
    await expect(page.getByText('Establecimiento no encontrado')).toBeVisible();
    await page.getByRole('link', { name: 'Volver al listado' }).click();
    await expect(page).toHaveURL(/\/admin\/establecimientos$/);
  });

  test('las publicaciones de toda la red son supervisables', async ({ page }) => {
    await page.goto('/admin/publicaciones');
    await expect(page.locator('main')).toBeVisible();
    // Cada publicación nombra su establecimiento, en tabla o en tarjeta.
    await expect(textoVisible(page, /Supermercado Verde|Cocina Raíz|Panadería El Trigal/)).toBeVisible();
  });

  test('actividad reutiliza la vista de publicaciones', async ({ page }) => {
    await page.goto('/admin/actividad');
    await expect(page.locator('main')).toBeVisible();
  });

  test('una ruta desconocida del panel vuelve al resumen', async ({ page }) => {
    await page.goto('/admin/esto-no-existe');
    await expect(page).toHaveURL(/\/admin\/inicio/);
  });

  test('el recorrido del superadmin no deja errores en consola', async ({ page, erroresDeConsola }) => {
    for (const ruta of ['/admin/inicio', '/admin/establecimientos', '/admin/publicaciones', '/admin/actividad']) {
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
    }
    expect(erroresReales(erroresDeConsola)).toEqual([]);
  });
});
