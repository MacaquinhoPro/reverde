import { CUENTAS, entrarComo, entrarConFormulario, expect, test } from './fixtures';

test.describe('acceso y protección de rutas', () => {
  test('la portada ofrece entrar y explorar sin sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Reverde/i);
    await expect(page.getByRole('link', { name: /Iniciar sesión|Ingresar|Entrar/i }).first()).toBeVisible();
  });

  test.describe('accesos rápidos', () => {
    for (const [role, cuenta] of Object.entries(CUENTAS)) {
      test(`entrar como ${role} lleva a ${cuenta.home}`, async ({ page }) => {
        await entrarComo(page, role as keyof typeof CUENTAS);
        await expect(page).toHaveURL(new RegExp(cuenta.home));
        await expect(page.getByText(cuenta.nombre.split(' ')[0]).first()).toBeVisible();
      });
    }
  });

  test('el formulario acepta una cuenta demo', async ({ page }) => {
    await entrarConFormulario(page, 'restaurante1@reverde.com', 'Demo1234');
    await expect(page).toHaveURL(/\/app\/inicio/);
  });

  test('rechaza la contraseña incorrecta sin iniciar sesión', async ({ page }) => {
    await entrarConFormulario(page, 'supermercado1@reverde.com', 'ClaveMala');
    await expect(page.getByText(/Contraseña incorrecta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('rechaza un correo que no existe', async ({ page }) => {
    await entrarConFormulario(page, 'nadie@reverde.com', 'Demo1234');
    await expect(page.getByText(/No encontramos una cuenta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('sin sesión, el panel del establecimiento redirige al login', async ({ page }) => {
    await page.goto('/app/inventario');
    await expect(page).toHaveURL(/\/login/);
  });

  test('sin sesión, el panel del superadmin redirige al login', async ({ page }) => {
    await page.goto('/admin/inicio');
    await expect(page).toHaveURL(/\/login/);
  });

  test('un cliente no puede entrar al panel del establecimiento', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/app/inventario');
    await expect(page).toHaveURL(/\/tienda/);
  });

  test('un administrador de establecimiento no puede entrar al panel global', async ({ page }) => {
    await entrarComo(page, 'supermercado');
    await page.goto('/admin/establecimientos');
    await expect(page).toHaveURL(/\/app\/inicio/);
  });

  test('un superadmin no entra al panel de un establecimiento', async ({ page }) => {
    await entrarComo(page, 'superadmin');
    await page.goto('/app/inventario');
    await expect(page).toHaveURL(/\/admin\/inicio/);
  });

  test('el marketplace se puede explorar sin iniciar sesión', async ({ page }) => {
    await page.goto('/tienda/explorar');
    await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('cerrar sesión devuelve a un estado sin sesión y vacía el carrito', async ({ page }) => {
    await entrarComo(page, 'cliente');
    await page.goto('/tienda/explorar');
    await page.locator('article').first().getByRole('button', { name: /Agregar .* al carrito/i }).click();

    await page.goto('/tienda/perfil');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await page.goto('/tienda/carrito');
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
  });

  test('una ruta inexistente vuelve a la portada', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe');
    await expect(page).toHaveURL(/\/$/);
  });
});
