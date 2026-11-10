/**
 * Adaptador de Wompi (https://docs.wompi.co).
 *
 * Por qué Wompi y no Mercado Pago (decisión documentada en docs/PAYMENTS.md):
 *  - Es colombiano y liquida en COP sin conversión; cubre tarjetas, PSE,
 *    Nequi, Bancolombia y Daviplata, que es la mezcla real del país.
 *  - El Web Checkout alojado se integra con una URL firmada: Reverde no ve ni
 *    guarda datos de tarjeta, y el alcance PCI queda en el proveedor.
 *  - La firma de integridad del checkout y el checksum del webhook son
 *    verificables sin SDK, así que no hay dependencia extra que auditar.
 * Mercado Pago sigue siendo viable: implementar esta misma interfaz basta.
 *
 * Firma de integridad: SHA256(referencia + montoEnCentavos + moneda + secreto)
 * Checksum del evento: SHA256(valores de las propiedades firmadas + timestamp + secreto)
 */
import { createHash } from 'node:crypto';
import { env } from '../../config/env.ts';
import { logger } from '../../lib/logger.ts';
import { RetryableHttpError, withRetry } from '../../lib/retry.ts';
import { safeEqual } from '../../lib/crypto.ts';
import { serverError } from '../../lib/errors.ts';
import {
  mapWompiMethod,
  mapWompiStatus,
  type CheckoutIntent,
  type CheckoutSession,
  type PaymentProviderAdapter,
  type ProviderEvent,
} from './provider.ts';

export function integritySignature(reference: string, amountInCents: number, currency: string, secret: string): string {
  return createHash('sha256').update(`${reference}${amountInCents}${currency}${secret}`).digest('hex');
}

/** Lee un valor anidado del payload: "transaction.status" → payload.data.transaction.status */
function pick(payload: Record<string, unknown>, path: string): unknown {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, data);
}

export function eventChecksum(payload: Record<string, unknown>, secret: string): string {
  const signature = (payload.signature ?? {}) as { properties?: string[] };
  const properties = signature.properties ?? [];
  const concatenated = properties.map((prop) => String(pick(payload, prop) ?? '')).join('');
  // El timestamp entra en la firma: así un evento capturado no se puede reusar.
  return createHash('sha256').update(`${concatenated}${payload.timestamp ?? ''}${secret}`).digest('hex');
}

export const wompiAdapter: PaymentProviderAdapter = {
  name: 'wompi',

  async createCheckout(intent: CheckoutIntent): Promise<CheckoutSession> {
    if (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET) {
      throw serverError('Wompi no está configurado: faltan WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET.');
    }
    const signature = integritySignature(
      intent.reference,
      intent.amountInCents,
      intent.currency,
      env.WOMPI_INTEGRITY_SECRET,
    );

    const params = new URLSearchParams({
      'public-key': env.WOMPI_PUBLIC_KEY,
      currency: intent.currency,
      'amount-in-cents': String(intent.amountInCents),
      reference: intent.reference,
      'signature:integrity': signature,
      'redirect-url': intent.redirectUrl,
      'expiration-time': intent.expiresAt.toISOString(),
      'customer-data:email': intent.customerEmail,
      'customer-data:full-name': intent.customerFullName,
    });

    return {
      checkoutUrl: `${env.WOMPI_CHECKOUT_URL}?${params.toString()}`,
      integritySignature: signature,
      snapshot: { provider: 'wompi', reference: intent.reference, amountInCents: intent.amountInCents },
    };
  },

  parseEvent(rawBody: Buffer): ProviderEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const transaction = (pick(payload, 'transaction') ?? {}) as Record<string, unknown>;
    const signature = (payload.signature ?? {}) as { checksum?: string };

    const expected = env.WOMPI_EVENTS_SECRET ? eventChecksum(payload, env.WOMPI_EVENTS_SECRET) : '';
    const received = String(signature.checksum ?? '');
    const signatureValid = Boolean(expected) && received.length === expected.length && safeEqual(received.toLowerCase(), expected);

    if (!signatureValid) logger.warn({ reference: transaction.reference }, 'webhook de Wompi con firma inválida');

    return {
      // Wompi no manda un id de evento: se deriva de la transacción, su estado
      // y el timestamp firmado, que es justo lo que lo hace único e idempotente.
      eventId: `wompi:${String(transaction.id ?? 'sin-id')}:${String(transaction.status ?? '')}:${String(payload.timestamp ?? '')}`,
      eventType: String(payload.event ?? 'transaction.updated'),
      reference: transaction.reference ? String(transaction.reference) : null,
      transactionId: transaction.id ? String(transaction.id) : null,
      status: mapWompiStatus(transaction.status as string),
      method: mapWompiMethod(transaction.payment_method_type as string),
      amountInCents: typeof transaction.amount_in_cents === 'number' ? transaction.amount_in_cents : null,
      signatureValid,
      payload,
    };
  },

  /**
   * Consulta directa a la API de Wompi. El webhook dice qué pasó, pero antes
   * de dar un pago por bueno se confirma contra el proveedor: así una
   * notificación falsificada tampoco sirve.
   */
  async fetchTransaction(transactionId: string) {
    if (!env.WOMPI_PRIVATE_KEY) return null;
    try {
      // La consulta es de solo lectura, así que se puede reintentar sin riesgo
      // de cobrar dos veces. Un 4xx (transacción inexistente, llave inválida)
      // no se reintenta: no va a cambiar.
      return await withRetry(
        async () => {
          const response = await fetch(`${env.WOMPI_API_URL}/transactions/${encodeURIComponent(transactionId)}`, {
            headers: { Authorization: `Bearer ${env.WOMPI_PRIVATE_KEY}` },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            throw new RetryableHttpError(
              `Wompi respondió ${response.status} al consultar la transacción`,
              response.status,
            );
          }
          const body = (await response.json()) as { data?: Record<string, unknown> };
          const tx = body.data ?? {};
          return {
            status: mapWompiStatus(tx.status as string),
            amountInCents: Number(tx.amount_in_cents ?? 0),
            reference: String(tx.reference ?? ''),
          };
        },
        { operation: 'wompi.fetchTransaction', attempts: 3, baseDelayMs: 400 },
      );
    } catch (error) {
      // Quien llama decide: no se confirma el pago si no se pudo verificar.
      logger.warn({ err: error, transactionId }, 'no se pudo consultar la transacción en Wompi');
      return null;
    }
  },
};
