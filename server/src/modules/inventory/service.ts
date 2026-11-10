/**
 * Servicios de inventario.
 *
 * Todo cambio de existencias pasa por aquí para que quede registrado en
 * InventoryMovement y para que las bajadas de stock sean atómicas: se usan
 * `updateMany` con condición sobre la cantidad, de modo que dos compras
 * simultáneas nunca puedan dejar el stock en negativo (la segunda afecta cero
 * filas y falla).
 */
import type { MovementType, Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma.ts';
import { conflict, notFound } from '../../lib/errors.ts';
import { buildAlertCopy, buildRecommendation, computeRisk, suggestDiscount } from '../../domain/risk.ts';
import { availableOf, riskInputOf } from '../../domain/serialize.ts';

type Client = Tx | Prisma.TransactionClient;

export interface MovementMeta {
  establishmentId: string;
  reason?: string;
  orderId?: string | null;
  userId?: string | null;
}

async function logMovement(
  tx: Client,
  productId: string,
  inventoryId: string,
  type: MovementType,
  quantity: number,
  meta: MovementMeta,
) {
  await tx.inventoryMovement.create({
    data: {
      inventoryId,
      productId,
      establishmentId: meta.establishmentId,
      type,
      quantity,
      reason: meta.reason ?? null,
      orderId: meta.orderId ?? null,
      userId: meta.userId ?? null,
    },
  });
}

/** Fija el stock físico a un valor concreto (edición manual del inventario). */
export async function setOnHand(tx: Client, productId: string, quantity: number, meta: MovementMeta) {
  const inventory = await tx.inventory.findUnique({ where: { productId } });
  if (!inventory) throw notFound('El producto no tiene inventario asociado.');
  if (quantity < inventory.reservedQuantity) {
    throw conflict(
      `No puedes bajar el stock a ${quantity}: hay ${inventory.reservedQuantity} unidades reservadas en pedidos pendientes.`,
    );
  }
  const delta = quantity - inventory.quantity;
  if (delta === 0) return inventory;
  const updated = await tx.inventory.update({ where: { productId }, data: { quantity } });
  await logMovement(tx, productId, inventory.id, delta > 0 ? 'ingreso' : 'ajuste', delta, meta);
  return updated;
}

/**
 * Reserva stock para una orden pendiente de pago. Atómico: si no queda
 * suficiente disponible, no modifica nada y devuelve false.
 */
export async function reserve(tx: Client, productId: string, quantity: number, meta: MovementMeta): Promise<boolean> {
  const result = await tx.$executeRaw`
    UPDATE "Inventory"
       SET "reservedQuantity" = "reservedQuantity" + ${quantity},
           "updatedAt" = NOW()
     WHERE "productId" = ${productId}
       AND "quantity" - "reservedQuantity" >= ${quantity}
  `;
  if (result !== 1) return false;
  const inventory = await tx.inventory.findUniqueOrThrow({ where: { productId } });
  await logMovement(tx, productId, inventory.id, 'reserva', -quantity, meta);
  return true;
}

/** Libera una reserva (pago fallido, orden cancelada o vencida). */
export async function release(tx: Client, productId: string, quantity: number, meta: MovementMeta): Promise<void> {
  const result = await tx.$executeRaw`
    UPDATE "Inventory"
       SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${quantity}),
           "updatedAt" = NOW()
     WHERE "productId" = ${productId}
  `;
  if (result !== 1) return;
  const inventory = await tx.inventory.findUniqueOrThrow({ where: { productId } });
  await logMovement(tx, productId, inventory.id, 'liberacion', quantity, meta);
}

/**
 * Confirma la venta: la reserva se convierte en salida real de stock.
 * Es la operación que ejecuta el webhook cuando el pago queda aprobado.
 */
export async function commit(tx: Client, productId: string, quantity: number, meta: MovementMeta): Promise<void> {
  const result = await tx.$executeRaw`
    UPDATE "Inventory"
       SET "quantity" = GREATEST(0, "quantity" - ${quantity}),
           "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${quantity}),
           "updatedAt" = NOW()
     WHERE "productId" = ${productId}
  `;
  if (result !== 1) throw notFound('El producto ya no existe en inventario.');
  const inventory = await tx.inventory.findUniqueOrThrow({ where: { productId } });
  await logMovement(tx, productId, inventory.id, 'venta', -quantity, meta);

  // Sin stock el producto deja de estar disponible y su publicación se agota.
  if (inventory.quantity === 0) {
    await tx.product.update({ where: { id: productId }, data: { status: 'agotado' } });
    await tx.marketplaceListing.updateMany({ where: { productId }, data: { status: 'agotada' } });
  }
}

/** Salida de stock por donación o merma. */
export async function writeOff(
  tx: Client,
  productId: string,
  quantity: number,
  type: Extract<MovementType, 'donacion' | 'merma'>,
  meta: MovementMeta,
): Promise<void> {
  const inventory = await tx.inventory.findUniqueOrThrow({ where: { productId } });
  const amount = Math.min(quantity, inventory.quantity - inventory.reservedQuantity);
  if (amount <= 0) throw conflict('No hay stock libre para dar de baja.');
  await tx.inventory.update({ where: { productId }, data: { quantity: { decrement: amount } } });
  await logMovement(tx, productId, inventory.id, type, -amount, meta);
}

/* ─────────────── Alertas y recomendaciones persistidas ─────────────── */

/**
 * Recalcula el Risk Score de todo el inventario de un establecimiento y
 * sincroniza sus alertas y recomendaciones. Se llama al consultar alertas o
 * recomendaciones y después de cada cambio de inventario, así lo que se
 * muestra siempre refleja los datos guardados.
 */
export async function syncIntelligence(establishmentId: string) {
  const [products, history, existingAlerts] = await Promise.all([
    prisma.product.findMany({
      where: { establishmentId, deletedAt: null },
      include: { inventory: true },
    }),
    prisma.promoOutcome.findMany({
      where: { OR: [{ establishmentId }, { isSeed: true }] },
      select: { category: true, discountPercent: true, sellThrough: true, daysToSell: true },
      take: 500,
      orderBy: { occurredAt: 'desc' },
    }),
    // Se leen las alertas vigentes para no pisar un silencio que la persona
    // puso a mano: recalcular el riesgo no debe reabrir lo que ya silenció.
    prisma.expirationAlert.findMany({
      where: { establishmentId },
      select: { productId: true, status: true, snoozedUntil: true },
    }),
  ]);
  const alertByProduct = new Map(existingAlerts.map((a) => [a.productId, a]));

  const now = new Date();
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const product of products) {
    const available = availableOf(product);
    const input = riskInputOf(product, available);
    const risk = computeRisk(input, now);
    const rec = buildRecommendation(input, risk, history);
    const discount = suggestDiscount(input, risk, history);
    const copy = buildAlertCopy(input, risk, discount);

    operations.push(
      prisma.recommendation.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          establishmentId,
          title: rec.title,
          rationale: rec.rationale,
          learningNote: rec.learningNote ?? null,
          suggestedDiscount: rec.suggestedDiscount,
          confidence: rec.confidence,
          riskScore: risk.score,
          actions: rec.actions,
        },
        update: {
          title: rec.title,
          rationale: rec.rationale,
          learningNote: rec.learningNote ?? null,
          suggestedDiscount: rec.suggestedDiscount,
          confidence: rec.confidence,
          riskScore: risk.score,
          actions: rec.actions,
        },
      }),
    );

    // Solo generan alerta los productos con riesgo real y stock disponible.
    const deservesAlert = risk.level !== 'bajo' && available > 0;
    if (deservesAlert) {
      const current = alertByProduct.get(product.id);
      // Un silencio vigente se respeta; uno vencido deja que la alerta vuelva.
      const stillSnoozed =
        current?.status === 'silenciada' && current.snoozedUntil !== null && current.snoozedUntil > now;

      operations.push(
        prisma.expirationAlert.upsert({
          where: { productId: product.id },
          create: {
            productId: product.id,
            establishmentId,
            level: risk.level,
            riskScore: risk.score,
            wasteProbability: risk.wasteProbability,
            title: copy.title,
            body: copy.body,
          },
          update: {
            level: risk.level,
            riskScore: risk.score,
            wasteProbability: risk.wasteProbability,
            title: copy.title,
            body: copy.body,
            // El texto y el puntaje siempre se refrescan; el estado solo se
            // reabre si no hay un silencio activo (una resuelta sí vuelve
            // cuando el riesgo persiste).
            ...(stillSnoozed ? {} : { status: 'abierta' as const, resolvedAt: null, snoozedUntil: null }),
          },
        }),
      );
    } else {
      operations.push(
        prisma.expirationAlert.updateMany({
          where: { productId: product.id, status: { not: 'resuelta' } },
          data: { status: 'resuelta', resolvedAt: now },
        }),
      );
    }
  }

  // Una sola transacción: las alertas nunca quedan a medio actualizar.
  if (operations.length) await prisma.$transaction(operations);
  return { products: products.length };
}

/** Marca como vencidos los productos que pasaron su fecha de vencimiento. */
export async function expireProducts(): Promise<number> {
  const result = await prisma.product.updateMany({
    where: { expiryDate: { lt: new Date() }, status: { in: ['en_inventario', 'publicado'] }, deletedAt: null },
    data: { status: 'vencido' },
  });
  if (result.count > 0) {
    await prisma.marketplaceListing.updateMany({
      where: { product: { status: 'vencido' }, status: 'activa' },
      data: { status: 'pausada', unpublishedAt: new Date() },
    });
  }
  return result.count;
}
