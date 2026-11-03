/**
 * Contrato de la pasarela de pagos.
 *
 * Reverde nunca toca datos de tarjeta: la persona paga en el checkout alojado
 * del proveedor y el backend solo crea la intención, guarda la referencia y
 * espera el webhook firmado. Cambiar de proveedor es implementar esta
 * interfaz; hoy hay dos: `wompi` (real, sandbox o producción) y `mock`
 * (simulador local con la misma firma, para desarrollo y pruebas).
 */
import type { PaymentProvider, PaymentStatus } from '@prisma/client';

export interface CheckoutIntent {
  reference: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
  customerFullName: string;
  /** A dónde vuelve el navegador después de pagar (no confirma nada). */
  redirectUrl: string;
  expiresAt: Date;
  orderCode: string;
}

export interface CheckoutSession {
  checkoutUrl: string;
  integritySignature?: string;
  snapshot: Record<string, unknown>;
}

export interface ProviderEvent {
  eventId: string;
  eventType: string;
  reference: string | null;
  transactionId: string | null;
  status: PaymentStatus;
  method: string | null;
  amountInCents: number | null;
  signatureValid: boolean;
  payload: unknown;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  /** Crea la intención de pago y devuelve la URL del checkout alojado. */
  createCheckout(intent: CheckoutIntent): Promise<CheckoutSession>;
  /** Valida la firma del webhook y normaliza el evento. */
  parseEvent(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent;
  /** Consulta el estado real en el proveedor (fuente de verdad). */
  fetchTransaction?(transactionId: string): Promise<{ status: PaymentStatus; amountInCents: number; reference: string } | null>;
}

/** Traducción de los estados del proveedor a los de Reverde. */
export function mapWompiStatus(status: string | undefined | null): PaymentStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'APPROVED';
    case 'DECLINED':
      return 'DECLINED';
    case 'VOIDED':
      return 'VOIDED';
    case 'ERROR':
      return 'ERROR';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

/** Método de pago informado por la pasarela → enum de Reverde. */
export function mapWompiMethod(method: string | undefined | null) {
  switch ((method ?? '').toUpperCase()) {
    case 'CARD':
      return 'tarjeta' as const;
    case 'PSE':
      return 'pse' as const;
    case 'NEQUI':
      return 'nequi' as const;
    case 'BANCOLOMBIA_TRANSFER':
    case 'BANCOLOMBIA_COLLECT':
      return 'bancolombia' as const;
    default:
      return null;
  }
}
