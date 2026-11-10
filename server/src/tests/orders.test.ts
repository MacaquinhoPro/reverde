import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createProduct, createUser, login, prisma, resetDatabase, scenario } from './helpers.ts';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('carrito', () => {
  it('agrega, modifica y quita productos recalculando los totales en el backend', async () => {
    const { product } = await scenario({ quantity: 10, price: 10_000, discountPercent: 20 });
    const client = await login('compra@test.co');

    const add = await client.post('/api/cart/items', { productId: product.id, qty: 2 });
    expect(add.status).toBe(200);
    expect(add.body.data.count).toBe(2);
    // 10.000 con 20 % → 8.000 c/u
    expect(add.body.data.subtotal).toBe(16_000);
    expect(add.body.data.savings).toBe(4000);
    expect(add.body.data.wasteAvoidedKg).toBeCloseTo(0.4, 2);

    const patch = await client.patch(`/api/cart/items/${product.id}`, { qty: 5 });
    expect(patch.body.data.subtotal).toBe(40_000);

    const del = await client.del(`/api/cart/items/${product.id}`);
    expect(del.body.data.count).toBe(0);
  });

  it('nunca deja pedir más unidades de las que hay', async () => {
    const { product } = await scenario({ quantity: 3 });
    const client = await login('compra@test.co');

    const res = await client.post('/api/cart/items', { productId: product.id, qty: 99 });
    expect(res.body.data.items[0].qty).toBe(3);
  });

  it('no admite productos sin publicar ni agotados', async () => {
    const { establishment } = await scenario();
    const oculto = await createProduct({ establishmentId: establishment.id, published: false, name: 'No publicado' });
    const agotado = await createProduct({ establishmentId: establishment.id, quantity: 0, name: 'Agotado' });
    const client = await login('compra@test.co');

    expect((await client.post('/api/cart/items', { productId: oculto.id, qty: 1 })).status).toBe(404);
    expect((await client.post('/api/cart/items', { productId: agotado.id, qty: 1 })).status).toBe(400);
  });

  it('avisa cuando el stock cambió después de agregar al carrito', async () => {
    const { product } = await scenario({ quantity: 5 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 5 });

    // El establecimiento baja el stock por su lado.
    await prisma.inventory.update({ where: { productId: product.id }, data: { quantity: 2 } });

    const res = await client.get('/api/cart');
    expect(res.body.data.issues).toHaveLength(1);
    expect(res.body.data.issues[0].issue).toBe('stock_insuficiente');
    expect(res.body.data.issues[0].available).toBe(2);
  });

  it('ignora el precio que mande el cliente: siempre usa el de la base de datos', async () => {
    const { product } = await scenario({ quantity: 5, price: 10_000, discountPercent: 0 });
    const client = await login('compra@test.co');

    // Se inyectan campos de precio a propósito.
    await client.post('/api/cart/items', { productId: product.id, qty: 1, unitPrice: 1, price: 1, total: 1 });
    const res = await client.get('/api/cart');
    expect(res.body.data.subtotal).toBe(10_000);
  });

  it('cada persona tiene su propio carrito', async () => {
    const { product } = await scenario();
    await createUser({ email: 'otra@test.co', role: 'cliente' });
    const a = await login('compra@test.co');
    const b = await login('otra@test.co');

    await a.post('/api/cart/items', { productId: product.id, qty: 2 });
    expect((await b.get('/api/cart')).body.data.count).toBe(0);
    expect((await a.get('/api/cart')).body.data.count).toBe(2);
  });
});

describe('creación de pedidos', () => {
  it('crea la orden en PENDING_PAYMENT, reserva el stock y vacía el carrito', async () => {
    const { product } = await scenario({ quantity: 10, price: 10_000, discountPercent: 20 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 3 });

    const res = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
    expect(res.status).toBe(201);
    expect(res.body.data.paymentStatus).toBe('PENDING_PAYMENT');
    expect(res.body.data.total).toBe(24_000);
    expect(res.body.data.savings).toBe(6000);
    expect(res.body.data.code).toMatch(/^RV-/);

    // El stock queda reservado, no descontado: todavía no hay pago.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(10);
    expect(inventory.reservedQuantity).toBe(3);

    // Y el marketplace ya muestra solo lo vendible.
    const market = await client.get(`/api/marketplace/products/${product.id}`);
    expect(market.body.data.quantity).toBe(7);

    expect((await client.get('/api/cart')).body.data.count).toBe(0);

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { productId: product.id, type: 'reserva' },
    });
    expect(movement.quantity).toBe(-3);
  });

  it('el total lo calcula el backend aunque el cliente mande otro', async () => {
    const { product } = await scenario({ quantity: 5, price: 20_000, discountPercent: 50 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 2 });

    const res = await client.post('/api/orders', {
      mode: 'compra',
      paymentMethod: 'tarjeta',
      total: 1,
      items: [{ productId: product.id, qty: 100, unitPrice: 1 }],
    });
    expect(res.status).toBe(201);
    // 20.000 con 50 % → 10.000 × 2
    expect(res.body.data.total).toBe(20_000);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].qty).toBe(2);
  });

  it('rechaza un carrito vacío', async () => {
    await scenario();
    const client = await login('compra@test.co');
    const res = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
    expect(res.status).toBe(400);
  });

  it('no deja comprar un producto que se despublicó mientras estaba en el carrito', async () => {
    const { product } = await scenario({ quantity: 5 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 1 });
    await prisma.product.update({ where: { id: product.id }, data: { status: 'en_inventario' } });

    const res = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
    expect(res.status).toBe(409);
    // No quedó ninguna reserva colgando.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBe(0);
  });

  it('no deja comprar sin stock suficiente y no deja reservas a medias', async () => {
    const { establishment, product } = await scenario({ quantity: 5 });
    const segundo = await createProduct({ establishmentId: establishment.id, quantity: 10, name: 'Con stock' });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 5 });
    await client.post('/api/cart/items', { productId: segundo.id, qty: 2 });

    // El stock del primero desaparece justo antes de confirmar.
    await prisma.inventory.update({ where: { productId: product.id }, data: { quantity: 1 } });

    const res = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
    expect(res.status).toBe(409);
    // La transacción se deshizo completa: ni orden ni reservas parciales.
    expect(await prisma.order.count()).toBe(0);
    const inventarios = await prisma.inventory.findMany();
    expect(inventarios.every((i) => i.reservedQuantity === 0)).toBe(true);
  });

  it('la idempotencia evita pedidos duplicados por doble clic', async () => {
    const { product } = await scenario({ quantity: 10 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 2 });

    const primera = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' }, { 'idempotency-key': 'clic-1' });
    const segunda = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' }, { 'idempotency-key': 'clic-1' });

    expect(primera.status).toBe(201);
    expect(segunda.body.data.id).toBe(primera.body.data.id);
    expect(segunda.headers['idempotent-replay']).toBe('true');
    expect(await prisma.order.count()).toBe(1);
    // Y solo se reservó una vez.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBe(2);
  });

  it('una reserva se paga en el establecimiento y no pasa por la pasarela', async () => {
    const { product } = await scenario({ quantity: 5 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 1 });

    const res = await client.post('/api/orders', { mode: 'reserva', paymentMethod: 'establecimiento' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('reservado');
    // No vence: el producto queda apartado hasta recogerlo.
    expect(res.body.data.expiresAt).toBeNull();

    const checkout = await client.post(`/api/orders/${res.body.data.id}/checkout`, {});
    expect(checkout.status).toBe(400);
  });

  it('una reserva con tarjeta no tiene sentido y se rechaza', async () => {
    const { product } = await scenario();
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 1 });
    expect((await client.post('/api/orders', { mode: 'reserva', paymentMethod: 'tarjeta' })).status).toBe(400);
  });

  it('cancelar un pedido pendiente libera el stock', async () => {
    const { product } = await scenario({ quantity: 10 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 4 });
    const order = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });

    const res = await client.post(`/api/orders/${order.body.data.id}/cancel`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('CANCELLED');

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBe(0);
    expect(inventory.quantity).toBe(10);
  });

  it('nadie puede ver ni cancelar el pedido de otra persona', async () => {
    const { product } = await scenario({ quantity: 10 });
    await createUser({ email: 'ajena@test.co', role: 'cliente' });
    const dueña = await login('compra@test.co');
    const ajena = await login('ajena@test.co');

    await dueña.post('/api/cart/items', { productId: product.id, qty: 1 });
    const order = await dueña.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });

    expect((await ajena.get(`/api/orders/${order.body.data.id}`)).status).toBe(404);
    expect((await ajena.post(`/api/orders/${order.body.data.id}/cancel`, {})).status).toBe(404);
  });

  it('las órdenes sin pagar vencen y devuelven el stock al marketplace', async () => {
    const { product } = await scenario({ quantity: 6 });
    const client = await login('compra@test.co');
    await client.post('/api/cart/items', { productId: product.id, qty: 6 });
    const order = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });

    // Agotado para el marketplace mientras la reserva está viva.
    expect((await client.get('/api/marketplace')).body.meta.total).toBe(0);

    await prisma.order.update({
      where: { id: order.body.data.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const { expireStaleOrders } = await import('../modules/orders/service.ts');
    expect(await expireStaleOrders()).toBe(1);

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.body.data.id } });
    expect(fresh.status).toBe('EXPIRED');
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBe(0);
    // Y vuelve a estar comprable.
    expect((await client.get('/api/marketplace')).body.meta.total).toBe(1);
  });

  it('entregar una reserva registra la venta y descuenta el inventario', async () => {
    const { product } = await scenario({ quantity: 8, price: 10_000, discountPercent: 25 });
    const buyer = await login('compra@test.co');
    await buyer.post('/api/cart/items', { productId: product.id, qty: 2 });
    const order = await buyer.post('/api/orders', { mode: 'reserva', paymentMethod: 'establecimiento' });

    const admin = await login('admin.est@test.co');
    const res = await admin.post(`/api/orders/${order.body.data.id}/deliver`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('entregado');

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(6);
    expect(inventory.reservedQuantity).toBe(0);

    const sale = await prisma.sale.findFirstOrThrow({ where: { orderId: order.body.data.id } });
    expect(sale.channel).toBe('tienda');
    expect(sale.recovered).toBe(15_000);

    // Entregar dos veces no duplica la venta.
    await admin.post(`/api/orders/${order.body.data.id}/deliver`, {});
    expect(await prisma.sale.count({ where: { orderId: order.body.data.id } })).toBe(1);
  });
});
