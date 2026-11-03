/**
 * Procesamiento de los eventos de la pasarela.
 *
 * Secuencia de confianza:
 *  1. Se valida la firma del evento (checksum del proveedor).
 *  2. Se guarda el evento con su `eventId` único → un reenvío no hace nada.
 *  3. Se busca el pago por la referencia que generó el backend.
 *  4. Se compara el monto notificado con el monto guardado.
 *  5. Si el proveedor lo soporta, se consulta la transacción directamente.
 *  6. Solo entonces se confirma la orden.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.ts';
import { env } from '../../config/env.ts';
import { logger } from '../../lib/logger.ts';
import { confirmOrderPaid, failOrder } from '../orders/service.ts';
import { gateway } from './index.ts';
import type { ProviderEvent } from './provider.ts';

export type WebhookOutcome =
  | 'confirmed'
  | 'duplicate'
  | 'failed'
  | 'ignored'
  | 'invalid_signature'
  | 'unknown_reference'
  | 'amount_mismatch';

export async function processProviderEvent(event: ProviderEvent): Promise<WebhookOutcome> {
  const provider = gateway().name;

  // 1 · Firma. Un evento sin firma válida se registra y se descarta.
  if (!event.signatureValid) {
    await prisma.paymentEvent
      .create({
        data: {
          provider,
          eventId: event.eventId,
          eventType: event.eventType,
          transactionId: event.transactionId,
          reportedStatus: event.status,
          signatureValid: false,
          payload: event.payload as object,
          processedAt: new Date(),
          result: 'invalid_signature',
        },
      })
      .catch(() => {});
    logger.warn({ provider, reference: event.reference }, 'evento de pasarela con firma inválida');
    return 'invalid_signature';
  }

  // 2 · Idempotencia: `eventId` es único en la base de datos.
  let stored;
  try {
    stored = await prisma.paymentEvent.create({
      data: {
        provider,
        eventId: event.eventId,
        eventType: event.eventType,
        transactionId: event.transactionId,
        reportedStatus: event.status,
        signatureValid: true,
        payload: event.payload as object,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info({ eventId: event.eventId }, 'evento de pasarela duplicado: se ignora');
      return 'duplicate';
    }
    throw error;
  }

  const finish = async (result: WebhookOutcome, paymentId?: string) => {
    await prisma.paymentEvent.update({
      where: { id: stored!.id },
      data: { processedAt: new Date(), result, ...(paymentId ? { paymentId } : {}) },
    });
    return result;
  };

  // 3 · La referencia la generó este backend: si no existe, no es nuestra.
  if (!event.reference) return finish('unknown_reference');
  const payment = await prisma.payment.findUnique({
    where: { reference: event.reference },
    include: { order: true },
  });
  if (!payment) {
    logger.warn({ reference: event.reference }, 'evento con referencia desconocida');
    return finish('unknown_reference');
  }

  // 4 · El monto no se negocia: tiene que coincidir con el que se cobró.
  if (event.amountInCents !== null && event.amountInCents !== payment.amountInCents) {
    logger.error(
      { reference: event.reference, esperado: payment.amountInCents, recibido: event.amountInCents },
      'monto del evento distinto al de la orden',
    );
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'ERROR', providerSnapshot: { motivo: 'monto_no_coincide' } },
    });
    return finish('amount_mismatch', payment.id);
  }

  // 5 · Verificación contra el proveedor. El webhook avisa; la API confirma.
  let status = event.status;
  const adapter = gateway();
  if (event.transactionId && adapter.fetchTransaction) {
    const remote = await adapter.fetchTransaction(event.transactionId);
    if (remote) {
      if (remote.reference && remote.reference !== payment.reference) return finish('unknown_reference', payment.id);
      if (remote.amountInCents && remote.amountInCents !== payment.amountInCents) {
        return finish('amount_mismatch', payment.id);
      }
      status = remote.status;
    } else if (env.PAYMENTS_PROVIDER === 'wompi' && env.isProd) {
      // En producción no se confirma un pago que no se pudo verificar.
      logger.error({ transactionId: event.transactionId }, 'no se pudo verificar la transacción: no se confirma');
      return finish('ignored', payment.id);
    }
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status,
      providerTransactionId: event.transactionId ?? payment.providerTransactionId,
      method: (event.method as never) ?? payment.method,
      providerSnapshot: { eventType: event.eventType, status, transactionId: event.transactionId },
    },
  });

  // 6 · Efectos sobre la orden.
  if (status === 'APPROVED') {
    const result = await confirmOrderPaid(payment.orderId, payment.id);
    return finish(result === 'confirmed' ? 'confirmed' : result === 'already_confirmed' ? 'duplicate' : 'ignored', payment.id);
  }

  if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED' || status === 'EXPIRED') {
    await failOrder(
      payment.orderId,
      payment.id,
      status === 'VOIDED' ? 'CANCELLED' : status === 'EXPIRED' ? 'EXPIRED' : 'FAILED',
      status,
      `Pago ${status} informado por ${provider}`,
    );
    return finish('failed', payment.id);
  }

  // PENDING u otros estados intermedios: no se toca la orden.
  return finish('ignored', payment.id);
}
