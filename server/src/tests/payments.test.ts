import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, login, payOrder, prisma, resetDatabase, scenario } from './helpers.ts';
import { buildMockEvent, mockSecret } from '../modules/payments/mock.ts';
import { eventChecksum, integritySignature } from '../modules/payments/wompi.ts';
import { env } from '../config/env.ts';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/** Deja un pedido listo para pagar y devuelve sus referencias. */
async function pendingOrder(options: { quantity?: number; price?: number; discountPercent?: number; qty?: number } = {}) {
  const { product } = await scenario({
    quantity: options.quantity ?? 10,
    price: options.price ?? 10_000,
    discountPercent: options.discountPercent ?? 20,
  });
  const client = await login('compra@test.co');
  await client.post('/api/cart/items', { productId: product.id, qty: options.qty ?? 2 });
  const res = await client.post('/api/orders', { mode: 'compra', paymentMethod: 'tarjeta' });
  const orderId = res.body.data.id as string;
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
  return { client, product, orderId, payment, order: res.body.data };
}

describe('checkout de la pasarela', () => {
  it('devuelve una URL alojada y no pide datos de tarjeta', async () => {
    const { client, orderId, payment } = await pendingOrder();

    const res = await client.post(`/api/orders/${orderId}/checkout`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.checkoutUrl).toContain('/api/payments/mock/checkout');
    expect(res.body.data.reference).toBe(payment.reference);

    // El monto va en centavos y la firma de integridad cuadra.
    const url = new URL(res.body.data.checkoutUrl);
    expect(url.searchParams.get('amount-in-cents')).toBe(String(payment.amountInCents));
    expect(url.searchParams.get('signature:integrity')).toBe(
      integritySignature(payment.reference, payment.amountInCents, 'COP', mockSecret()),
    );
    // Ningún campo de tarjeta en el contrato.
    expect(JSON.stringify(res.body).toLowerCase()).not.toMatch(/cvv|card_number|numero_tarjeta/);
  });

  it('el monto en centavos corresponde exactamente al total calculado', async () => {
    const { order, payment } = await pendingOrder({ price: 10_000, discountPercent: 20, qty: 3 });
    expect(order.total).toBe(24_000);
    expect(payment.amountInCents).toBe(2_400_000);
  });

  it('pedir el checkout dos veces devuelve la misma URL (no crea otro cobro)', async () => {
    const { client, orderId } = await pendingOrder();
    const a = await client.post(`/api/orders/${orderId}/checkout`, {});
    const b = await client.post(`/api/orders/${orderId}/checkout`, {});
    expect(b.body.data.checkoutUrl).toBe(a.body.data.checkoutUrl);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
  });

  it('la configuración pública no expone llaves privadas', async () => {
    const res = await request(app).get('/api/payments/config');
    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('mock');
    expect(res.body.data.sandbox).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('prv_');
    expect(JSON.stringify(res.body)).not.toContain(mockSecret());
  });

  it('no se puede volver a cobrar un pedido ya pagado', async () => {
    const { client, orderId } = await pendingOrder();
    await payOrder(orderId, 'APPROVED');
    const res = await client.post(`/api/orders/${orderId}/checkout`, {});
    expect(res.status).toBe(409);
  });
});

describe('la redirección del navegador no confirma el pago', () => {
  it('el pedido sigue pendiente hasta que llega el webhook', async () => {
    const { client, orderId, product } = await pendingOrder();
    await client.post(`/api/orders/${orderId}/checkout`, {});

    // Simula que la persona volvió del checkout sin que el webhook llegara.
    const status = await client.get(`/api/payments/status/${orderId}`);
    expect(status.body.data.orderStatus).toBe('PENDING_PAYMENT');
    expect(status.body.data.paymentStatus).toBe('PENDING');
    expect(status.body.data.paidAt).toBeNull();

    // Y el inventario sigue solo reservado.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(10);
    expect(await prisma.sale.count()).toBe(0);
  });
});

describe('webhook: autenticidad', () => {
  it('rechaza un evento con firma inválida y no toca la orden', async () => {
    const { orderId, payment, product } = await pendingOrder();

    const res = await request(app)
      .post('/api/payments/webhook/mock')
      .set('content-type', 'application/json')
      .send({
        event: 'transaction.updated',
        data: {
          transaction: {
            id: 'falsificada',
            status: 'APPROVED',
            reference: payment.reference,
            amount_in_cents: payment.amountInCents,
          },
        },
        timestamp: 1,
        signature: { properties: ['transaction.id', 'transaction.status'], checksum: 'firma-inventada' },
      });

    // Responde 200 para no provocar reintentos infinitos, pero descarta.
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('invalid_signature');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('PENDING_PAYMENT');
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(10);
    expect(await prisma.sale.count()).toBe(0);

    // Queda registrado para investigación.
    const evento = await prisma.paymentEvent.findFirstOrThrow();
    expect(evento.signatureValid).toBe(false);
    expect(evento.result).toBe('invalid_signature');
  });

  it('rechaza un evento cuyo monto no coincide con el de la orden', async () => {
    const { orderId, payment } = await pendingOrder();
    const event = buildMockEvent({
      transactionId: 'tx-monto',
      reference: payment.reference,
      status: 'APPROVED',
      // El atacante intenta pagar 100 COP por un pedido de 24.000.
      amountInCents: 10_000,
    });

    const res = await request(app).post('/api/payments/webhook/mock').set('content-type', 'application/json').send(event);
    expect(res.body.outcome).toBe('amount_mismatch');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('PENDING_PAYMENT');
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('ERROR');
  });

  it('descarta un evento con una referencia que no generó este backend', async () => {
    await pendingOrder();
    const event = buildMockEvent({
      transactionId: 'tx-ajena',
      reference: 'RV-INVENTADA-0000',
      status: 'APPROVED',
      amountInCents: 2_400_000,
    });
    const res = await request(app).post('/api/payments/webhook/mock').set('content-type', 'application/json').send(event);
    expect(res.body.outcome).toBe('unknown_reference');
  });

  it('un cuerpo ilegible no tumba el servicio', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/mock')
      .set('content-type', 'application/json')
      .send('{ esto no es json');
    expect(res.status).toBe(202);
  });

  it('el checksum se calcula igual que lo documenta Wompi', () => {
    const payload = {
      data: { transaction: { id: 'abc', status: 'APPROVED', amount_in_cents: 5000 } },
      timestamp: 1530291411,
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
    };
    // SHA256("abc" + "APPROVED" + "5000" + timestamp + secreto)
    const esperado = eventChecksum(payload, 'secreto-de-prueba');
    expect(esperado).toHaveLength(64);
    // Cambiar un solo valor firmado cambia el checksum.
    const alterado = eventChecksum(
      { ...payload, data: { transaction: { id: 'abc', status: 'DECLINED', amount_in_cents: 5000 } } },
      'secreto-de-prueba',
    );
    expect(alterado).not.toBe(esperado);
  });
});

describe('webhook: pago aprobado', () => {
  it('confirma la orden, descuenta el inventario y registra la venta', async () => {
    const { client, orderId, product } = await pendingOrder({ quantity: 10, price: 10_000, discountPercent: 20, qty: 2 });

    const { outcome } = await payOrder(orderId, 'APPROVED');
    expect(outcome).toBe('confirmed');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('PAID');
    expect(order.fulfillmentStatus).toBe('confirmado');
    expect(order.paidAt).not.toBeNull();

    // La reserva se convirtió en salida real de stock.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(8);
    expect(inventory.reservedQuantity).toBe(0);

    const venta = await prisma.inventoryMovement.findFirstOrThrow({ where: { productId: product.id, type: 'venta' } });
    expect(venta.quantity).toBe(-2);

    // El libro de ventas alimenta las métricas.
    const sale = await prisma.sale.findFirstOrThrow({ where: { orderId } });
    expect(sale.recovered).toBe(16_000);
    expect(sale.channel).toBe('marketplace');
    expect(sale.wasteAvoidedKg).toBeCloseTo(0.4, 2);

    // Y el motor aprende del resultado de la promoción.
    expect(await prisma.promoOutcome.count({ where: { establishmentId: sale.establishmentId, isSeed: false } })).toBe(1);

    // La persona ve su pedido confirmado y sus métricas al día.
    const status = await client.get(`/api/payments/status/${orderId}`);
    expect(status.body.data.orderStatus).toBe('PAID');
    const me = await client.get('/api/dashboard/me');
    expect(me.body.data.orders).toBe(1);
    expect(me.body.data.saved).toBe(4000);
    expect(me.body.data.rescued).toBe(2);
  });

  it('agotar el stock marca el producto y retira la publicación', async () => {
    const { orderId, product } = await pendingOrder({ quantity: 2, qty: 2 });
    await payOrder(orderId, 'APPROVED');

    const fresh = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true, listing: true },
    });
    expect(fresh.inventory?.quantity).toBe(0);
    expect(fresh.status).toBe('agotado');
    expect(fresh.listing?.status).toBe('agotada');
    expect((await request(app).get('/api/marketplace')).body.meta.total).toBe(0);
  });

  it('notifica a la compradora y al establecimiento', async () => {
    const { orderId } = await pendingOrder();
    await payOrder(orderId, 'APPROVED');
    expect(await prisma.notification.count({ where: { type: 'order_paid' } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'order_received' } })).toBe(1);
  });
});

describe('webhook: idempotencia', () => {
  it('el mismo evento reenviado no cobra ni descuenta dos veces', async () => {
    const { orderId, product } = await pendingOrder({ quantity: 10, qty: 3 });
    const timestamp = 1_700_000_000;

    const primera = await payOrder(orderId, 'APPROVED', timestamp);
    expect(primera.outcome).toBe('confirmed');

    // Exactamente el mismo evento: mismo id y mismo timestamp firmado.
    const segunda = await payOrder(orderId, 'APPROVED', timestamp);
    expect(segunda.outcome).toBe('duplicate');
    const tercera = await payOrder(orderId, 'APPROVED', timestamp);
    expect(tercera.outcome).toBe('duplicate');

    // Un solo descuento de inventario y una sola venta.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(7);
    expect(await prisma.sale.count({ where: { orderId } })).toBe(1);
    expect(await prisma.inventoryMovement.count({ where: { productId: product.id, type: 'venta' } })).toBe(1);
    // El evento se guardó una sola vez (eventId es único).
    expect(await prisma.paymentEvent.count({ where: { result: 'confirmed' } })).toBe(1);
  });

  it('un evento distinto sobre una orden ya pagada tampoco la vuelve a cobrar', async () => {
    const { orderId, product } = await pendingOrder({ quantity: 10, qty: 3 });
    await payOrder(orderId, 'APPROVED', 1_700_000_001);
    // Otro timestamp → otro eventId, pero la orden ya está pagada.
    const repetido = await payOrder(orderId, 'APPROVED', 1_700_000_999);
    expect(repetido.outcome).toBe('duplicate');

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(7);
    expect(await prisma.sale.count({ where: { orderId } })).toBe(1);
  });
});

describe('webhook: pago rechazado', () => {
  it('libera el stock y deja la orden en FAILED', async () => {
    const { orderId, product } = await pendingOrder({ quantity: 10, qty: 4 });

    const { outcome } = await payOrder(orderId, 'DECLINED');
    expect(outcome).toBe('failed');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('FAILED');
    expect(order.fulfillmentStatus).toBe('anulado');

    // El stock vuelve completo al marketplace.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(10);
    expect(inventory.reservedQuantity).toBe(0);
    expect(await prisma.sale.count()).toBe(0);

    const liberacion = await prisma.inventoryMovement.findFirstOrThrow({
      where: { productId: product.id, type: 'liberacion' },
    });
    expect(liberacion.quantity).toBe(4);
    expect(await prisma.notification.count({ where: { type: 'order_failed' } })).toBe(1);
  });

  it('un rechazo después de un pago aprobado no revierte la venta', async () => {
    const { orderId, product } = await pendingOrder({ quantity: 10, qty: 2 });
    await payOrder(orderId, 'APPROVED', 1_700_000_100);
    await payOrder(orderId, 'DECLINED', 1_700_000_200);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('PAID');
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.quantity).toBe(8);
  });
});

describe('simulador de checkout', () => {
  it('sirve la página de pago y procesa el resultado', async () => {
    const { client, orderId, payment } = await pendingOrder();
    await client.post(`/api/orders/${orderId}/checkout`, {});

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const page = await request(app).get(`/api/payments/mock/checkout?reference=${payment.reference}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('SIMULADOR');
    // La página muestra el pedido y el monto reales, no los del cliente.
    expect(page.text).toContain(order.code);
    expect(page.text).toContain(payment.reference);

    const pay = await client.post('/api/payments/mock/simulate', { reference: payment.reference, status: 'APPROVED' });
    expect(pay.body.data.outcome).toBe('confirmed');
  });

  it('no existe en producción (la validación de arranque lo impide)', async () => {
    // `assertProductionSafety` falla si PAYMENTS_PROVIDER=mock con NODE_ENV=production.
    const { assertProductionSafety } = await import('../config/env.ts');
    expect(() =>
      assertProductionSafety({
        ...env,
        NODE_ENV: 'production',
        isProd: true,
        PAYMENTS_PROVIDER: 'mock',
        COOKIE_SECURE: true,
        APP_URL: 'https://reverde.app',
        API_URL: 'https://api.reverde.app',
        ENABLE_DEMO_ACCOUNTS: false,
        MAIL_TRANSPORT: 'smtp',
      }),
    ).toThrow(/PAYMENTS_PROVIDER no puede ser mock/);
  });
});

describe('eventos de pago auditables', () => {
  it('cada evento queda registrado con su resultado', async () => {
    const { client, orderId, payment } = await pendingOrder();
    await payOrder(orderId, 'APPROVED');

    const res = await client.get(`/api/payments/${payment.id}/events`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].result).toBe('confirmed');
    expect(res.body.data[0].signatureValid).toBe(true);
    // El payload crudo no se expone en esta vista.
    expect(res.body.data[0].payload).toBeUndefined();
  });
});
