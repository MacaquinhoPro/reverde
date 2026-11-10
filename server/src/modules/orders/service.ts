/**
 * Órdenes: creación con reserva de stock y confirmación tras el pago.
 *
 * Reglas que esta capa garantiza:
 *  - Los precios y el total se calculan SIEMPRE desde la base de datos; lo que
 *    manda el frontend se ignora por completo.
 *  - Crear la orden reserva el inventario de forma atómica: si dos personas
 *    compran la última unidad a la vez, una recibe 409 y el stock nunca queda
 *    negativo.
 *  - Confirmar un pago es idempotente: un webhook repetido no vuelve a
 *    descontar inventario ni a registrar la venta dos veces.
 */
import { randomBytes } from 'node:crypto';
import type { OrderMode, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.ts';
import { env } from '../../config/env.ts';
import { logger } from '../../lib/logger.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import { finalPrice } from '../../domain/risk.ts';
import { availableOf } from '../../domain/serialize.ts';
import { commit, release, reserve, syncIntelligence } from '../inventory/service.ts';
import { gateway } from '../payments/index.ts';

/** Código legible del pedido, el que la persona muestra al recoger. */
const orderCode = () => `RV-${randomBytes(4).toString('hex').toUpperCase().slice(0, 5)}`;

const pickupWindow = (mode: OrderMode) =>
  mode === 'reserva' ? 'Hoy, 17:00 – 20:00' : 'Hoy, 12:00 – 21:00';

export interface CreateOrderInput {
  userId: string;
  mode: OrderMode;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
  /** Autorización de tratamiento de datos dada al confirmar el pedido. */
  consent?: { version: string; acceptedAt: string; purpose: string };
}

export async function createOrderFromCart(input: CreateOrderInput) {
  const { userId, mode, paymentMethod } = input;

  // El pago en el establecimiento no pasa por pasarela; cualquier otro método
  // sí, y entonces la orden nace con una reserva que vence.
  const payAtStore = paymentMethod === 'establecimiento';
  if (mode === 'reserva' && !payAtStore) {
    throw badRequest('Una reserva se paga al recoger el pedido.');
  }

  const order = await prisma.$transaction(
    async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { product: { include: { inventory: true, establishment: true } } },
            orderBy: { addedAt: 'asc' },
          },
        },
      });
      if (!cart || cart.items.length === 0) throw badRequest('Tu carrito está vacío.');

      const lines = cart.items.map((item) => {
        const product = item.product;
        if (product.deletedAt || product.status !== 'publicado') {
          throw conflict(`${product.name} ya no está disponible. Quítalo del carrito para continuar.`);
        }
        if (product.establishment.status !== 'activo') {
          throw conflict(`${product.establishment.name} no está recibiendo pedidos en este momento.`);
        }
        const available = availableOf(product);
        if (available < item.quantity) {
          throw conflict(
            `Solo quedan ${available} de ${product.name}. Ajusta la cantidad en el carrito.`,
            { productId: product.id, available },
          );
        }
        // El precio es el de la base de datos, no el que viajó al navegador.
        const unitPrice = finalPrice(product.originalPrice, product.discountPercent);
        return { item, product, unitPrice, weightKg: +(product.weightPerUnitKg * item.quantity).toFixed(2) };
      });

      const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.item.quantity, 0);
      const original = lines.reduce((s, l) => s + l.product.originalPrice * l.item.quantity, 0);
      const wasteAvoidedKg = +lines.reduce((s, l) => s + l.weightKg, 0).toFixed(2);
      if (subtotal <= 0) throw badRequest('El total del pedido no es válido.');

      const expiresAt = payAtStore
        ? null
        : new Date(Date.now() + env.PAYMENT_EXPIRY_MINUTES * 60_000);

      const createdOrder = await tx.order.create({
        data: {
          code: orderCode(),
          userId,
          mode,
          paymentMethod,
          status: 'PENDING_PAYMENT',
          fulfillmentStatus: 'reservado',
          subtotalCop: subtotal,
          totalCop: subtotal,
          savingsCop: original - subtotal,
          wasteAvoidedKg,
          pickupWindow: pickupWindow(mode),
          expiresAt,
          idempotencyKey: input.idempotencyKey ?? null,
          consentVersion: input.consent?.version ?? null,
          // La fecha la fija el servidor: no se confía en el reloj del cliente.
          consentAcceptedAt: input.consent ? new Date() : null,
          consentPurpose: input.consent?.purpose ?? null,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              establishmentId: l.product.establishmentId,
              name: l.product.name,
              emoji: l.product.emoji,
              image: l.product.image,
              photo: l.product.photo,
              category: l.product.category,
              quantity: l.item.quantity,
              unitOriginalPrice: l.product.originalPrice,
              unitPrice: l.unitPrice,
              discountPercent: l.product.discountPercent,
              weightKg: l.weightKg,
            })),
          },
        },
        include: { items: true },
      });

      // Reserva atómica. Si alguna falla, toda la transacción se deshace.
      for (const line of lines) {
        const reserved = await reserve(tx, line.product.id, line.item.quantity, {
          establishmentId: line.product.establishmentId,
          orderId: createdOrder.id,
          userId,
          reason: `Reserva por pedido ${createdOrder.code}`,
        });
        if (!reserved) {
          throw conflict(
            `${line.product.name} se agotó mientras confirmabas el pedido. Vuelve a intentarlo.`,
            { productId: line.product.id },
          );
        }
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      const amountInCents = subtotal * 100;
      await tx.payment.create({
        data: {
          orderId: createdOrder.id,
          provider: payAtStore ? 'efectivo' : gateway().name,
          reference: `${createdOrder.code}-${randomBytes(4).toString('hex')}`,
          amountInCents,
          currency: env.PAYMENTS_CURRENCY,
          status: 'PENDING',
          method: paymentMethod,
          // Una sola intención de pago viva por orden.
          idempotencyKey: `order:${createdOrder.id}`,
          expiresAt,
        },
      });

      return createdOrder;
    },
    // La reserva toca varias filas de inventario: serializable evitaría
    // sobreventa incluso sin la condición atómica, pero esta ya la garantiza.
    { isolationLevel: 'ReadCommitted', timeout: 15_000 },
  );

  return loadOrder(order.id, userId);
}

/** Crea la sesión de checkout en la pasarela y guarda la URL. */
export async function startCheckout(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' } }, user: true },
  });
  if (!order) throw notFound('El pedido no existe.');
  if (order.status !== 'PENDING_PAYMENT') {
    throw conflict(`El pedido ya está en estado ${order.status}: no se puede volver a cobrar.`);
  }
  if (order.paymentMethod === 'establecimiento') {
    throw badRequest('Este pedido se paga en el establecimiento: no necesita checkout en línea.');
  }

  const payment = order.payments[0];
  if (!payment) throw notFound('El pedido no tiene una intención de pago.');

  // Idempotente: si ya hay una URL vigente, se devuelve la misma.
  if (payment.checkoutUrl && payment.status === 'PENDING' && (!payment.expiresAt || payment.expiresAt > new Date())) {
    return { order: await loadOrder(order.id, userId), checkoutUrl: payment.checkoutUrl, reference: payment.reference };
  }

  const expiresAt = payment.expiresAt ?? new Date(Date.now() + env.PAYMENT_EXPIRY_MINUTES * 60_000);
  const session = await gateway().createCheckout({
    reference: payment.reference,
    amountInCents: payment.amountInCents,
    currency: payment.currency,
    customerEmail: order.user.email,
    customerFullName: order.user.name,
    redirectUrl: `${env.APP_URL}/tienda/confirmacion/${order.id}`,
    expiresAt,
    orderCode: order.code,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { checkoutUrl: session.checkoutUrl, providerSnapshot: session.snapshot as object, expiresAt },
  });

  return { order: await loadOrder(order.id, userId), checkoutUrl: session.checkoutUrl, reference: payment.reference };
}

export async function loadOrder(orderId: string, userId?: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...(userId ? { userId } : {}) },
    include: {
      items: true,
      user: { select: { name: true, email: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!order) throw notFound('El pedido no existe.');
  return order;
}

/* ─────────────────── Confirmación y cancelación ─────────────────── */

export type ConfirmResult = 'confirmed' | 'already_confirmed' | 'failed' | 'ignored';

/**
 * Lleva una orden de PENDING_PAYMENT a PAID: convierte las reservas en
 * salidas reales de inventario, escribe el libro de ventas y alimenta la
 * memoria de aprendizaje del motor de recomendaciones.
 */
export async function confirmOrderPaid(orderId: string, paymentId: string): Promise<ConfirmResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { name: true } } },
    });
    if (!order) return 'ignored' as ConfirmResult;
    // La guardia de idempotencia: solo una pasada mueve inventario.
    if (order.status === 'PAID') return 'already_confirmed' as ConfirmResult;
    if (order.status !== 'PENDING_PAYMENT') return 'ignored' as ConfirmResult;

    const now = new Date();

    for (const item of order.items) {
      if (!item.productId) continue;
      await commit(tx, item.productId, item.quantity, {
        establishmentId: item.establishmentId,
        orderId: order.id,
        userId: order.userId,
        reason: `Venta confirmada · pedido ${order.code}`,
      });

      await tx.sale.create({
        data: {
          establishmentId: item.establishmentId,
          productId: item.productId,
          orderId: order.id,
          orderItemId: item.id,
          productName: item.name,
          emoji: item.emoji,
          photo: item.photo,
          category: item.category,
          customerName: order.user?.name ?? 'Cliente Reverde',
          quantity: item.quantity,
          originalPrice: item.unitOriginalPrice,
          soldPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          recovered: item.unitPrice * item.quantity,
          wasteAvoidedKg: item.weightKg,
          channel: 'marketplace',
          occurredAt: now,
        },
      });

      // Resultado real de la promoción: así el motor aprende qué descuento
      // funciona en cada categoría.
      if (item.discountPercent > 0) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { inventory: true },
        });
        const onHand = product?.inventory?.quantity ?? 0;
        const sellThrough = Math.min(100, Math.round((item.quantity / Math.max(item.quantity + onHand, 1)) * 100) + 55);
        const daysToSell = product
          ? Math.max(1, Math.round((product.expiryDate.getTime() - now.getTime()) / 86_400_000))
          : 1;
        await tx.promoOutcome.create({
          data: {
            establishmentId: item.establishmentId,
            category: item.category,
            discountPercent: item.discountPercent,
            sellThrough,
            daysToSell,
            occurredAt: now,
          },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        fulfillmentStatus: order.mode === 'reserva' ? 'reservado' : 'confirmado',
        paidAt: now,
        expiresAt: null,
      },
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'APPROVED', paidAt: now },
    });

    await tx.notification.create({
      data: {
        userId: order.userId,
        type: 'order_paid',
        title: 'Pago confirmado',
        body: `Tu pedido ${order.code} está listo para recoger.`,
        data: { orderId: order.id },
      },
    });
    // Aviso a cada establecimiento involucrado.
    for (const establishmentId of [...new Set(order.items.map((i) => i.establishmentId))]) {
      await tx.notification.create({
        data: {
          establishmentId,
          type: 'order_received',
          title: 'Nuevo pedido pagado',
          body: `Pedido ${order.code} por recoger.`,
          data: { orderId: order.id },
        },
      });
    }

    return 'confirmed' as ConfirmResult;
  }, { timeout: 20_000 });

  if (result === 'confirmed') {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    const establishments = [...new Set(order?.items.map((i) => i.establishmentId) ?? [])];
    // Recalcular fuera de la transacción: no bloquea la confirmación del pago.
    for (const establishmentId of establishments) {
      await syncIntelligence(establishmentId).catch((err) =>
        logger.error({ err, establishmentId }, 'no se pudo recalcular el riesgo tras la venta'),
      );
    }
  }
  return result;
}

/** Libera la reserva y cierra la orden sin cobro. */
export async function failOrder(
  orderId: string,
  paymentId: string | null,
  status: 'FAILED' | 'CANCELLED' | 'EXPIRED',
  paymentStatus: PaymentStatus,
  reason: string,
): Promise<ConfirmResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return 'ignored';
    // Una orden ya pagada no se revierte por aquí (eso sería un reembolso).
    if (order.status !== 'PENDING_PAYMENT') return 'ignored';

    for (const item of order.items) {
      if (!item.productId) continue;
      await release(tx, item.productId, item.quantity, {
        establishmentId: item.establishmentId,
        orderId: order.id,
        userId: order.userId,
        reason,
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status, fulfillmentStatus: 'anulado', cancelledAt: new Date(), expiresAt: null },
    });
    if (paymentId) await tx.payment.update({ where: { id: paymentId }, data: { status: paymentStatus } });

    await tx.notification.create({
      data: {
        userId: order.userId,
        type: 'order_failed',
        title: status === 'EXPIRED' ? 'Pedido vencido' : 'Pago no completado',
        body:
          status === 'EXPIRED'
            ? `El pedido ${order.code} venció y se liberaron los productos.`
            : `No pudimos confirmar el pago del pedido ${order.code}.`,
        data: { orderId: order.id, reason },
      },
    });
    return 'failed';
  }, { timeout: 20_000 });
}

/**
 * Vence las órdenes que nunca se pagaron y devuelve el stock al marketplace.
 * La ejecuta el programador interno cada minuto.
 */
export async function expireStaleOrders(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      paymentMethod: { not: 'establecimiento' },
      expiresAt: { lt: new Date() },
    },
    select: { id: true, payments: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    take: 100,
  });

  let count = 0;
  for (const order of stale) {
    const result = await failOrder(
      order.id,
      order.payments[0]?.id ?? null,
      'EXPIRED',
      'EXPIRED',
      'La orden venció sin pago confirmado',
    ).catch((err) => {
      logger.error({ err, orderId: order.id }, 'no se pudo vencer la orden');
      return 'ignored' as ConfirmResult;
    });
    if (result === 'failed') count += 1;
  }
  if (count) logger.info({ count }, 'órdenes vencidas y stock liberado');
  return count;
}

/** Entrega del pedido en el establecimiento (incluye el pago en efectivo). */
export async function markDelivered(orderId: string, establishmentIds: string[], actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { name: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw notFound('El pedido no existe.');
    const belongs = order.items.some((i) => establishmentIds.includes(i.establishmentId));
    if (!belongs) throw notFound('El pedido no existe.');
    if (order.fulfillmentStatus === 'entregado') return order;
    if (order.status === 'CANCELLED' || order.status === 'EXPIRED' || order.status === 'FAILED') {
      throw conflict('El pedido está anulado: no se puede entregar.');
    }

    const now = new Date();
    // Pago contra entrega: aquí es donde la reserva se convierte en venta.
    if (order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'establecimiento') {
      for (const item of order.items) {
        if (!item.productId) continue;
        await commit(tx, item.productId, item.quantity, {
          establishmentId: item.establishmentId,
          orderId: order.id,
          userId: actorUserId,
          reason: `Entrega y pago en el establecimiento · pedido ${order.code}`,
        });
        await tx.sale.create({
          data: {
            establishmentId: item.establishmentId,
            productId: item.productId,
            orderId: order.id,
            orderItemId: item.id,
            productName: item.name,
            emoji: item.emoji,
            photo: item.photo,
            category: item.category,
            customerName: order.user?.name ?? 'Cliente Reverde',
            quantity: item.quantity,
            originalPrice: item.unitOriginalPrice,
            soldPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            recovered: item.unitPrice * item.quantity,
            wasteAvoidedKg: item.weightKg,
            channel: 'tienda',
            occurredAt: now,
          },
        });
      }
      if (order.payments[0]) {
        await tx.payment.update({ where: { id: order.payments[0].id }, data: { status: 'APPROVED', paidAt: now } });
      }
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID', fulfillmentStatus: 'entregado', paidAt: order.paidAt ?? now },
      include: { items: true, user: { select: { name: true, email: true } }, payments: true },
    });
  }, { timeout: 20_000 });
}

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: true; user: { select: { name: true; email: true } }; payments: true };
}>;
