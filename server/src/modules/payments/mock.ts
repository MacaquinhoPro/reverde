/**
 * Simulador de pasarela para desarrollo y pruebas.
 *
 * Reproduce exactamente el contrato de Wompi (misma forma de evento, misma
 * fórmula de checksum) pero el checkout es una página servida por esta misma
 * API. Así el flujo completo —redirección, pago, webhook firmado,
 * confirmación, descuento de inventario— se puede probar sin cuenta externa y
 * sin red, y las pruebas de webhook duplicado o con firma inválida son reales.
 *
 * Nunca se habilita en producción: `assertProductionSafety` lo impide.
 */
import { createHash } from 'node:crypto';
import { env } from '../../config/env.ts';
import { safeEqual } from '../../lib/crypto.ts';
import {
  mapWompiMethod,
  mapWompiStatus,
  type CheckoutIntent,
  type CheckoutSession,
  type PaymentProviderAdapter,
  type ProviderEvent,
} from './provider.ts';
import { eventChecksum, integritySignature } from './wompi.ts';

/** Secreto local del simulador: derivado, nunca uno de producción. */
export const mockSecret = (): string =>
  createHash('sha256').update(`mock-events:${env.ENCRYPTION_KEY}`).digest('hex').slice(0, 32);

/** Construye un evento firmado idéntico en forma a los de Wompi. */
export function buildMockEvent(input: {
  transactionId: string;
  reference: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
  amountInCents: number;
  method?: string;
  timestamp?: number;
}) {
  const payload: Record<string, unknown> = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: input.transactionId,
        status: input.status,
        reference: input.reference,
        amount_in_cents: input.amountInCents,
        currency: env.PAYMENTS_CURRENCY,
        payment_method_type: input.method ?? 'CARD',
      },
    },
    sent_at: new Date().toISOString(),
    timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: '',
    },
    environment: 'test',
  };
  (payload.signature as { checksum: string }).checksum = eventChecksum(payload, mockSecret());
  return payload;
}

export const mockAdapter: PaymentProviderAdapter = {
  name: 'mock',

  async createCheckout(intent: CheckoutIntent): Promise<CheckoutSession> {
    const signature = integritySignature(intent.reference, intent.amountInCents, intent.currency, mockSecret());
    const params = new URLSearchParams({
      reference: intent.reference,
      'amount-in-cents': String(intent.amountInCents),
      currency: intent.currency,
      'signature:integrity': signature,
      'redirect-url': intent.redirectUrl,
      order: intent.orderCode,
    });
    return {
      checkoutUrl: `${env.API_URL}/api/payments/mock/checkout?${params.toString()}`,
      integritySignature: signature,
      snapshot: { provider: 'mock', reference: intent.reference, amountInCents: intent.amountInCents },
    };
  },

  parseEvent(rawBody: Buffer): ProviderEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const data = (payload.data ?? {}) as { transaction?: Record<string, unknown> };
    const transaction = data.transaction ?? {};
    const signature = (payload.signature ?? {}) as { checksum?: string };

    const expected = eventChecksum(payload, mockSecret());
    const received = String(signature.checksum ?? '');
    const signatureValid = received.length === expected.length && safeEqual(received.toLowerCase(), expected);

    return {
      eventId: `mock:${String(transaction.id ?? 'sin-id')}:${String(transaction.status ?? '')}:${String(payload.timestamp ?? '')}`,
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

  /** El simulador es su propia fuente de verdad: confía en el evento firmado. */
  async fetchTransaction() {
    return null;
  },
};
