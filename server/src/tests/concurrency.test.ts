import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, STRONG_PASSWORD, createProduct, createUser, login, payOrder, prisma, resetDatabase, scenario } from './helpers.ts';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/** Abre sesión para N compradoras distintas. */
async function buyers(count: number): Promise<Client[]> {
  const clients: Client[] = [];
  for (let i = 0; i < count; i++) {
    const email = `comprador${i}@test.co`;
    await createUser({ email, role: 'cliente', name: `Compradora ${i}` });
    clients.push(await login(email, STRONG_PASSWORD));
  }
  return clients;
}

describe('concurrencia de compras', () => {
  it('con una sola unidad, de diez intentos simultáneos gana exactamente uno', async () => {
    const { product } = await scenario({ quantity: 1 });
    const clients = await buyers(10);

    // Todas ponen la última unidad en su carrito.
    await Promise.all(clients.map((c) => c.post('/api/cart/items', { productId: product.id, qty: 1 })));

    // Y confirman el pedido al mismo tiempo.
    const results = await Promise.all(
      clients.map((c) => c.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' })),
    );

    const creadas = results.filter((r) => r.status === 201);
    const rechazadas = results.filter((r) => r.status === 409);
    expect(creadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(9);
    // El mensaje explica qué pasó, sin filtrar nada.
    expect(rechazadas[0].body.error.code).toBe('conflict');

    // El stock nunca queda negativo ni sobre-reservado.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(1);
    expect(inventory.reservedQuantity).toBe(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it('reparte el stock exacto entre varias compras simultáneas sin sobrevender', async () => {
    const { product } = await scenario({ quantity: 5 });
    const clients = await buyers(8);

    await Promise.all(clients.map((c) => c.post('/api/cart/items', { productId: product.id, qty: 2 })));
    const results = await Promise.all(
      clients.map((c) => c.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' })),
    );

    const creadas = results.filter((r) => r.status === 201);
    // Con 5 unidades y pedidos de 2, caben como máximo 2 pedidos.
    expect(creadas.length).toBeLessThanOrEqual(2);
    expect(creadas.length).toBeGreaterThanOrEqual(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.reservedQuantity).toBe(creadas.length * 2);
    expect(inventory.reservedQuantity).toBeLessThanOrEqual(inventory.quantity);
  });

  it('pagar varias órdenes a la vez descuenta el inventario una sola vez por orden', async () => {
    const { product } = await scenario({ quantity: 6 });
    const clients = await buyers(3);

    const orders: string[] = [];
    for (const client of clients) {
      await client.post('/api/cart/items', { productId: product.id, qty: 2 });
      const res = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
      expect(res.status).toBe(201);
      orders.push(res.body.data.id);
    }

    // Los tres webhooks llegan al mismo tiempo.
    const outcomes = await Promise.all(orders.map((id) => payOrder(id, 'APPROVED')));
    expect(outcomes.every((o) => o.outcome === 'confirmed')).toBe(true);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(0);
    expect(inventory.reservedQuantity).toBe(0);
    expect(await prisma.sale.count()).toBe(3);
  });

  it('el mismo webhook llegando en paralelo solo surte efecto una vez', async () => {
    const { product } = await scenario({ quantity: 10 });
    const client = (await buyers(1))[0];
    await client.post('/api/cart/items', { productId: product.id, qty: 3 });
    const order = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
    const timestamp = 1_700_000_500;

    // Cinco entregas simultáneas del mismo evento.
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => payOrder(order.body.data.id, 'APPROVED', timestamp).catch(() => ({ outcome: 'error' }))),
    );
    expect(outcomes.filter((o) => o.outcome === 'confirmed')).toHaveLength(1);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(7);
    expect(await prisma.sale.count()).toBe(1);
  });

  it('agregar al carrito en paralelo no supera el stock disponible', async () => {
    const { product } = await scenario({ quantity: 4 });
    const client = (await buyers(1))[0];

    await Promise.all(Array.from({ length: 10 }, () => client.post('/api/cart/items', { productId: product.id, qty: 1 })));
    const cart = await client.get('/api/cart');
    expect(cart.body.data.items[0].qty).toBeLessThanOrEqual(4);
  });

  it('dos pedidos sobre productos distintos no se bloquean entre sí', async () => {
    const { establishment, product } = await scenario({ quantity: 3 });
    const otro = await createProduct({ establishmentId: establishment.id, quantity: 3, name: 'Otro producto' });
    const [a, b] = await buyers(2);

    await a.post('/api/cart/items', { productId: product.id, qty: 3 });
    await b.post('/api/cart/items', { productId: otro.id, qty: 3 });

    const results = await Promise.all([
      a.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' }),
      b.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' }),
    ]);
    expect(results.every((r) => r.status === 201)).toBe(true);
  });
});
