import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createProduct, login, prisma, resetDatabase, scenario } from './helpers.ts';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('CRUD de productos', () => {
  it('crea el producto con su inventario y su movimiento de ingreso', async () => {
    const { establishment } = await scenario();
    const client = await login('admin.est@test.co');

    const res = await client.post('/api/products', {
      name: 'Croissants de mantequilla',
      description: 'Horneados hoy',
      category: 'Panadería',
      emoji: '🥐',
      quantity: 32,
      unit: 'unidad',
      weightPerUnitKg: 0.09,
      entryDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86_400_000).toISOString(),
      originalPrice: 4200,
      discountPercent: 40,
      dailySales: 14,
      status: 'publicado',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(32);
    expect(res.body.data.establishmentId).toBe(establishment.id);
    // El precio final lo calcula el backend.
    expect(res.body.data.price).toBe(2500);
    // Y trae su Risk Score ya calculado.
    expect(res.body.data.risk.level).toBe('alto');

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { productId: res.body.data.id, type: 'ingreso' },
    });
    expect(movement.quantity).toBe(32);
    // Publicado → existe la publicación del marketplace.
    expect(await prisma.marketplaceListing.count({ where: { productId: res.body.data.id } })).toBe(1);
  });

  it('valida los datos de entrada', async () => {
    await scenario();
    const client = await login('admin.est@test.co');
    const base = {
      name: 'Producto',
      category: 'Lácteos',
      quantity: 5,
      unit: 'unidad',
      weightPerUnitKg: 0.2,
      entryDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86_400_000).toISOString(),
      originalPrice: 5000,
    };

    expect((await client.post('/api/products', { ...base, name: 'ab' })).status).toBe(400);
    expect((await client.post('/api/products', { ...base, originalPrice: -1 })).status).toBe(400);
    expect((await client.post('/api/products', { ...base, category: 'Inventada' })).status).toBe(400);
    expect((await client.post('/api/products', { ...base, discountPercent: 95 })).status).toBe(400);
    // Vencimiento anterior al ingreso.
    expect(
      (await client.post('/api/products', { ...base, expiryDate: new Date(Date.now() - 86_400_000).toISOString() }))
        .status,
    ).toBe(400);
  });

  it('actualiza el producto y registra el ajuste de existencias', async () => {
    const { product } = await scenario({ quantity: 10 });
    const client = await login('admin.est@test.co');

    const res = await client.patch(`/api/products/${product.id}`, { quantity: 25, discountPercent: 30 });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(25);
    expect(res.body.data.discountPercent).toBe(30);

    const ajuste = await prisma.inventoryMovement.findFirstOrThrow({
      where: { productId: product.id, type: 'ingreso', reason: { contains: 'Ajuste' } },
    });
    expect(ajuste.quantity).toBe(15);
  });

  it('la baja es lógica: conserva el histórico', async () => {
    const { product } = await scenario();
    const client = await login('admin.est@test.co');

    expect((await client.del(`/api/products/${product.id}`)).status).toBe(200);
    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(fresh.deletedAt).not.toBeNull();
    // Ya no aparece en el inventario ni en el marketplace.
    expect((await client.get('/api/products')).body.meta.total).toBe(0);
    expect((await client.get('/api/marketplace')).body.meta.total).toBe(0);
  });

  it('publica y despublica manteniendo el estado y la publicación en línea', async () => {
    const { product } = await scenario();
    const client = await login('admin.est@test.co');

    expect((await client.post(`/api/marketplace/listings/${product.id}/unpublish`, {})).status).toBe(200);
    expect((await client.get('/api/marketplace')).body.meta.total).toBe(0);
    let listing = await prisma.marketplaceListing.findUniqueOrThrow({ where: { productId: product.id } });
    expect(listing.status).toBe('pausada');

    expect((await client.post(`/api/marketplace/listings/${product.id}/publish`, { featured: true })).status).toBe(200);
    expect((await client.get('/api/marketplace')).body.meta.total).toBe(1);
    listing = await prisma.marketplaceListing.findUniqueOrThrow({ where: { productId: product.id } });
    expect(listing.status).toBe('activa');
    expect(listing.featured).toBe(true);
  });
});

describe('inventario', () => {
  it('el resumen calcula valor y riesgo sobre datos reales', async () => {
    const { establishment } = await scenario({ quantity: 10, price: 10_000, discountPercent: 0 });
    await createProduct({ establishmentId: establishment.id, quantity: 5, price: 20_000, expiresInDays: 15, dailySales: 10, name: 'Tranquilo' });
    const client = await login('admin.est@test.co');

    const res = await client.get('/api/inventory/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.units).toBe(15);
    // 10 × 10.000 + 5 × 20.000
    expect(res.body.data.inventoryValue).toBe(200_000);
    expect(res.body.data.high + res.body.data.medium + res.body.data.low).toBe(2);
  });

  it('lista los productos próximos a vencer ordenados por urgencia', async () => {
    const { establishment } = await scenario();
    await createProduct({ establishmentId: establishment.id, expiresInDays: 1, name: 'Vence mañana' });
    await createProduct({ establishmentId: establishment.id, expiresInDays: 20, name: 'Vence en tres semanas' });
    const client = await login('admin.est@test.co');

    const res = await client.get('/api/inventory/expiring?days=3');
    const nombres = res.body.data.map((p: { name: string }) => p.name);
    expect(nombres).toContain('Vence mañana');
    expect(nombres).not.toContain('Vence en tres semanas');
  });

  it('el ajuste no puede dejar el stock por debajo de lo reservado', async () => {
    const { product } = await scenario({ quantity: 5 });
    await createUserCart(product.id, 3);
    const client = await login('admin.est@test.co');

    const res = await client.post(`/api/inventory/${product.id}/adjust`, { quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('reservadas');
  });

  it('registra mermas en el kardex', async () => {
    const { product } = await scenario({ quantity: 10 });
    const client = await login('admin.est@test.co');

    const res = await client.post(`/api/inventory/${product.id}/write-off`, { quantity: 3, reason: 'Cadena de frío interrumpida' });
    expect(res.status).toBe(200);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(7);

    const movements = await client.get(`/api/inventory/movements?productId=${product.id}`);
    const merma = movements.body.data.find((m: { type: string }) => m.type === 'merma');
    expect(merma.quantity).toBe(-3);
    expect(merma.reason).toContain('frío');
  });
});

describe('alertas y recomendaciones persistidas', () => {
  it('genera alerta para riesgo alto y no para riesgo bajo', async () => {
    const { establishment } = await scenario({ quantity: 40 });
    await createProduct({ establishmentId: establishment.id, quantity: 2, expiresInDays: 25, dailySales: 10, name: 'Sin riesgo' });
    const client = await login('admin.est@test.co');

    const res = await client.get('/api/alerts?pageSize=50');
    expect(res.status).toBe(200);
    const nombres = res.body.data.map((a: { product: { name: string } }) => a.product.name);
    expect(nombres).toContain('Yogur natural');
    expect(nombres).not.toContain('Sin riesgo');

    // Quedan guardadas, no son un cálculo del navegador.
    expect(await prisma.expirationAlert.count({ where: { establishmentId: establishment.id } })).toBeGreaterThan(0);
  });

  it('silenciar una alerta la saca de la bandeja y resolverla la cierra', async () => {
    const { product } = await scenario({ quantity: 40 });
    const client = await login('admin.est@test.co');

    const antes = await client.get('/api/alerts');
    const alerta = antes.body.data.find((a: { productId: string }) => a.productId === product.id);
    expect(alerta).toBeTruthy();

    expect((await client.post(`/api/alerts/${alerta.id}/snooze`, { hours: 24 })).status).toBe(200);
    const despues = await client.get('/api/alerts');
    expect(despues.body.data.some((a: { id: string }) => a.id === alerta.id)).toBe(false);

    // Al vencer el silencio vuelve a aparecer.
    await prisma.expirationAlert.update({
      where: { id: alerta.id },
      data: { snoozedUntil: new Date(Date.now() - 1000) },
    });
    const regreso = await client.get('/api/alerts');
    expect(regreso.body.data.some((a: { id: string }) => a.id === alerta.id)).toBe(true);
  });

  it('la recomendación explica el riesgo y cita el histórico de la categoría', async () => {
    const { establishment, product } = await scenario({ quantity: 40 });
    await prisma.promoOutcome.createMany({
      data: [
        { establishmentId: establishment.id, category: 'Lácteos', discountPercent: 30, sellThrough: 82, daysToSell: 2 },
        { establishmentId: establishment.id, category: 'Lácteos', discountPercent: 30, sellThrough: 78, daysToSell: 2 },
      ],
    });
    const client = await login('admin.est@test.co');

    const res = await client.get(`/api/recommendations/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.risk.factors).toHaveLength(4);
    expect(res.body.data.recommendation.learningNote).toContain('promociones anteriores');
    expect(res.body.data.history.length).toBe(2);
  });

  it('aplicar «descuento» cambia el precio y lo deja auditado', async () => {
    const { product } = await scenario({ quantity: 40, price: 10_000, discountPercent: 0 });
    const client = await login('admin.est@test.co');

    const res = await client.post(`/api/recommendations/${product.id}/apply`, { action: 'descuento', discount: 35 });
    expect(res.status).toBe(200);
    expect(res.body.data.product.discountPercent).toBe(35);
    expect(res.body.data.price).toBe(6500);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'recommendation.applied' } });
    expect((audit.metadata as { recommendedAction: string }).recommendedAction).toBe('descuento');
  });

  it('aplicar «caja de rescate» crea la caja y descuenta el stock de origen', async () => {
    const { product } = await scenario({ quantity: 9 });
    const client = await login('admin.est@test.co');

    const res = await client.post(`/api/recommendations/${product.id}/apply`, { action: 'caja_rescate' });
    expect(res.status).toBe(200);

    const caja = await prisma.product.findFirstOrThrow({
      where: { isRescueBox: true },
      include: { inventory: true },
    });
    expect(caja.inventory?.quantity).toBe(3);
    expect(caja.status).toBe('publicado');

    // Las 9 unidades de origen pasaron a la caja: el stock cuadra.
    const origen = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(origen.quantity).toBe(0);
  });

  it('aplicar «donar» registra la venta sin ingreso y marca el producto donado', async () => {
    const { product } = await scenario({ quantity: 8 });
    const client = await login('admin.est@test.co');

    const res = await client.post(`/api/recommendations/${product.id}/apply`, { action: 'donar' });
    expect(res.status).toBe(200);

    const sale = await prisma.sale.findFirstOrThrow({ where: { productId: product.id } });
    expect(sale.customerName).toBe('Banco de Alimentos');
    expect(sale.recovered).toBe(0);
    expect(sale.wasteAvoidedKg).toBeCloseTo(1.6, 2);

    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: { inventory: true } });
    expect(fresh.status).toBe('donado');
    expect(fresh.inventory?.quantity).toBe(0);
  });
});

/** Deja `qty` unidades reservadas creando un pedido pendiente de pago. */
async function createUserCart(productId: string, qty: number) {
  const { createUser } = await import('./helpers.ts');
  await createUser({ email: `reserva${Math.random()}@test.co`, role: 'cliente' });
  const buyers = await prisma.user.findMany({ where: { role: 'cliente' }, orderBy: { createdAt: 'desc' }, take: 1 });
  const client = await login(buyers[0].email);
  await client.post('/api/cart/items', { productId, qty });
  await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
}
