import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, createEstablishment, createProduct, createUser, login, prisma, resetDatabase } from './helpers.ts';
import { syncIntelligence } from '../modules/inventory/service.ts';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/** Dos establecimientos con inventario propio y su respectivo administrador. */
async function twoTenants() {
  const verde = await createEstablishment({ name: 'Supermercado Verde', slug: 'verde' });
  const colina = await createEstablishment({ name: 'Mercado La Colina', slug: 'colina' });
  const adminVerde = await createUser({ email: 'verde@test.co', role: 'supermercado', establishmentId: verde.id });
  const adminColina = await createUser({ email: 'colina@test.co', role: 'supermercado', establishmentId: colina.id });
  const prodVerde = await createProduct({ establishmentId: verde.id, name: 'Yogur Verde' });
  const prodColina = await createProduct({ establishmentId: colina.id, name: 'Leche Colina' });
  await syncIntelligence(verde.id);
  await syncIntelligence(colina.id);
  return { verde, colina, adminVerde, adminColina, prodVerde, prodColina };
}

describe('control de acceso por rol', () => {
  it('sin sesión no se accede a nada protegido', async () => {
    const anon = new Client();
    for (const path of ['/api/products', '/api/alerts', '/api/cart', '/api/orders', '/api/dashboard/overview', '/api/admin/overview']) {
      expect((await anon.get(path)).status, path).toBe(401);
    }
  });

  it('el marketplace y el directorio son públicos', async () => {
    const anon = new Client();
    expect((await anon.get('/api/marketplace')).status).toBe(200);
    expect((await anon.get('/api/establishments')).status).toBe(200);
    expect((await anon.get('/api/marketplace/facets')).status).toBe(200);
  });

  it('un comprador no entra a las funciones de establecimiento', async () => {
    await createUser({ email: 'compra@test.co', role: 'cliente' });
    const client = await login('compra@test.co');
    for (const path of ['/api/products', '/api/alerts', '/api/recommendations', '/api/inventory/summary', '/api/dashboard/overview']) {
      const res = await client.get(path);
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    }
  });

  it('un establecimiento no entra al panel de la plataforma', async () => {
    const est = await createEstablishment();
    await createUser({ email: 'est@test.co', role: 'supermercado', establishmentId: est.id });
    const client = await login('est@test.co');
    expect((await client.get('/api/admin/overview')).status).toBe(403);
    expect((await client.get('/api/admin/users')).status).toBe(403);
    expect((await client.get('/api/admin/audit')).status).toBe(403);
  });

  it('un establecimiento no puede comprar con el carrito (no es su rol)', async () => {
    const est = await createEstablishment();
    await createUser({ email: 'est2@test.co', role: 'supermercado', establishmentId: est.id });
    const client = await login('est2@test.co');
    expect((await client.get('/api/cart')).status).toBe(403);
  });

  it('el superadministrador llega a todo', async () => {
    await createUser({ email: 'root@test.co', role: 'superadmin' });
    const client = await login('root@test.co');
    expect((await client.get('/api/admin/overview')).status).toBe(200);
    expect((await client.get('/api/admin/users')).status).toBe(200);
    expect((await client.get('/api/orders/admin/all')).status).toBe(200);
  });

  it('cambiar el rol de alguien invalida sus sesiones abiertas', async () => {
    const est = await createEstablishment();
    const persona = await createUser({ email: 'asciende@test.co', role: 'cliente' });
    await createUser({ email: 'root2@test.co', role: 'superadmin' });

    const suSesion = await login('asciende@test.co');
    expect((await suSesion.get('/api/auth/me')).status).toBe(200);

    const root = await login('root2@test.co');
    const res = await root.patch(`/api/admin/users/${persona.id}`, { role: 'supermercado' });
    expect(res.status).toBe(200);
    // La sesión vieja todavía decía «cliente»: se cierra a propósito.
    expect((await suSesion.get('/api/auth/me')).status).toBe(401);
    void est;
  });
});

describe('aislamiento entre establecimientos', () => {
  it('cada administrador solo ve su propio inventario', async () => {
    const { adminVerde, prodVerde, prodColina } = await twoTenants();
    const client = await login('verde@test.co');

    const list = await client.get('/api/products?pageSize=50');
    const ids = list.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(prodVerde.id);
    expect(ids).not.toContain(prodColina.id);
    void adminVerde;
  });

  it('pedir el establecimiento de otro devuelve 403, no sus datos', async () => {
    const { colina } = await twoTenants();
    const client = await login('verde@test.co');

    const res = await client.get(`/api/products?establishmentId=${colina.id}`);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('Leche Colina');
  });

  it('leer un producto ajeno por id devuelve 404 (no confirma que existe)', async () => {
    const { prodColina } = await twoTenants();
    const client = await login('verde@test.co');
    const res = await client.get(`/api/products/${prodColina.id}`);
    expect(res.status).toBe(404);
  });

  it('no se puede editar ni borrar un producto ajeno', async () => {
    const { prodColina } = await twoTenants();
    const client = await login('verde@test.co');

    expect((await client.patch(`/api/products/${prodColina.id}`, { name: 'Secuestrado' })).status).toBe(404);
    expect((await client.del(`/api/products/${prodColina.id}`)).status).toBe(404);
    expect((await client.post(`/api/products/${prodColina.id}/discount`, { percent: 80 })).status).toBe(404);
    expect((await client.post(`/api/inventory/${prodColina.id}/adjust`, { quantity: 0 })).status).toBe(404);

    // El producto ajeno quedó intacto.
    const fresh = await prisma.product.findUniqueOrThrow({
      where: { id: prodColina.id },
      include: { inventory: true },
    });
    expect(fresh.name).toBe('Leche Colina');
    expect(fresh.inventory?.quantity).toBe(10);
  });

  it('no se puede publicar ni despublicar lo de otro establecimiento', async () => {
    const { prodColina } = await twoTenants();
    const client = await login('verde@test.co');
    expect((await client.post(`/api/marketplace/listings/${prodColina.id}/unpublish`, {})).status).toBe(404);
  });

  it('las alertas y recomendaciones también están aisladas', async () => {
    const { prodColina } = await twoTenants();
    const client = await login('verde@test.co');

    const alerts = await client.get('/api/alerts?pageSize=50');
    expect(alerts.body.data.every((a: { productId: string }) => a.productId !== prodColina.id)).toBe(true);
    expect((await client.get(`/api/recommendations/${prodColina.id}`)).status).toBe(404);
  });

  it('las métricas de cada establecimiento solo cuentan sus ventas', async () => {
    const { verde, colina } = await twoTenants();
    await prisma.sale.createMany({
      data: [
        { establishmentId: verde.id, productName: 'A', category: 'Lácteos', customerName: 'X', quantity: 1, originalPrice: 1000, soldPrice: 700, discountPercent: 30, recovered: 700, wasteAvoidedKg: 1 },
        { establishmentId: colina.id, productName: 'B', category: 'Lácteos', customerName: 'Y', quantity: 5, originalPrice: 1000, soldPrice: 700, discountPercent: 30, recovered: 3500, wasteAvoidedKg: 5 },
      ],
    });

    const client = await login('verde@test.co');
    const res = await client.get('/api/dashboard/overview?days=30');
    expect(res.body.data.current.recovered).toBe(700);
    expect(res.body.data.current.rescued).toBe(1);
  });

  it('el superadministrador sí puede consultar un establecimiento concreto', async () => {
    const { colina, prodColina } = await twoTenants();
    await createUser({ email: 'root3@test.co', role: 'superadmin' });
    const root = await login('root3@test.co');

    const res = await root.get(`/api/products?establishmentId=${colina.id}&pageSize=50`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toContain(prodColina.id);
  });

  it('un establecimiento no ve los pedidos de otro ni las líneas ajenas', async () => {
    const { verde, colina, prodVerde, prodColina } = await twoTenants();
    const buyer = await createUser({ email: 'mixto@test.co', role: 'cliente' });
    const client = await login('mixto@test.co');

    // Un pedido con productos de los dos establecimientos.
    await client.post('/api/cart/items', { productId: prodVerde.id, qty: 1 });
    await client.post('/api/cart/items', { productId: prodColina.id, qty: 2 });
    const order = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
    expect(order.status).toBe(201);

    const verdeClient = await login('verde@test.co');
    const list = await verdeClient.get('/api/orders/establishment');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    // Solo la línea que le corresponde.
    expect(list.body.data[0].items).toHaveLength(1);
    expect(list.body.data[0].items[0].productId).toBe(prodVerde.id);
    expect(JSON.stringify(list.body)).not.toContain('Leche Colina');

    const detail = await verdeClient.get(`/api/orders/${order.body.data.id}`);
    expect(detail.body.data.items).toHaveLength(1);
    void verde;
    void colina;
    void buyer;
  });
});

describe('solicitudes de establecimiento', () => {
  it('solo el superadministrador aprueba, y al aprobar crea el establecimiento y cambia el rol', async () => {
    const client = new Client();
    await client.post('/api/auth/register', {
      name: 'Dueña',
      email: 'duena@test.co',
      password: 'Reverde2026',
      accountType: 'establecimiento',
      establishment: { name: 'Tienda Nueva', type: 'restaurante', address: 'Cra 1 #2-3', city: 'Cali' },
    });
    const request = await prisma.establishmentRequest.findFirstOrThrow();

    // La propia solicitante no puede aprobarse.
    expect((await client.post(`/api/admin/requests/${request.id}/approve`, {})).status).toBe(403);

    await createUser({ email: 'root4@test.co', role: 'superadmin' });
    const root = await login('root4@test.co');
    const res = await root.post(`/api/admin/requests/${request.id}/approve`, { notes: 'Documentos verificados' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('activo');

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'duena@test.co' },
      include: { memberships: true },
    });
    expect(user.role).toBe('restaurante');
    expect(user.memberships[0].role).toBe('owner');
    expect(user.memberships[0].establishmentId).toBe(res.body.data.id);

    // Aprobar dos veces no duplica el establecimiento.
    expect((await root.post(`/api/admin/requests/${request.id}/approve`, {})).status).toBe(409);
    expect(await prisma.establishment.count()).toBe(1);
  });
});
