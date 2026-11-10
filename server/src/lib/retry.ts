/**
 * Reintentos con retroceso exponencial para llamadas a servicios externos.
 *
 * Dos reglas que evitan hacer daño al reintentar:
 *
 *  1. **Solo se reintenta lo transitorio.** Un fallo de red, un timeout o un
 *     5xx pueden mejorar al repetir; un 4xx significa que la petición está mal
 *     y repetirla solo gasta tiempo y cuota.
 *  2. **Solo se reintenta lo idempotente.** Consultar el estado de una
 *     transacción se puede repetir sin consecuencias; *crear* un cobro no, y
 *     por eso `createCheckout` no usa esto (la protección ahí es la clave de
 *     idempotencia, no el reintento).
 *
 * El retroceso lleva una pequeña variación aleatoria («jitter») para que
 * varios procesos que fallaron a la vez no vuelvan a golpear al mismo tiempo.
 */
import { logger } from './logger.ts';

export interface RetryOptions {
  /** Nombre de la operación, para los logs. */
  operation: string;
  /** Número total de intentos, el primero incluido. */
  attempts?: number;
  /** Espera base en ms; crece 2^n en cada intento. */
  baseDelayMs?: number;
  /** Tope de espera entre intentos. */
  maxDelayMs?: number;
  /** ¿Vale la pena reintentar este error? Por defecto: errores de red y timeouts. */
  isRetryable?: (error: unknown) => boolean;
}

/** Un 5xx, un 429 o un fallo de transporte sí; un 4xx no. */
export class RetryableHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RetryableHttpError';
  }
}

const defaultIsRetryable = (error: unknown): boolean => {
  if (error instanceof RetryableHttpError) return error.status >= 500 || error.status === 429;
  if (error instanceof Error) {
    // Timeout de AbortSignal.timeout y errores de transporte de undici.
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
    return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|fetch failed/i.test(
      `${error.message} ${(error as { cause?: { code?: string } }).cause?.code ?? ''}`,
    );
  }
  return false;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta `fn` y la reintenta mientras el error sea transitorio.
 * Si se agotan los intentos, propaga el último error.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = options.attempts ?? 3;
  const base = options.baseDelayMs ?? 300;
  const max = options.maxDelayMs ?? 4000;
  const retryable = options.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await fn(attempt);
      if (attempt > 1) {
        logger.info({ operation: options.operation, attempt }, 'la operación externa funcionó al reintentar');
      }
      return result;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && retryable(error);
      if (!canRetry) {
        logger.warn(
          { err: error, operation: options.operation, attempt, retried: attempt > 1 },
          attempt < attempts ? 'error no transitorio: no se reintenta' : 'se agotaron los reintentos',
        );
        throw error;
      }
      // Retroceso exponencial con jitter de hasta el 30 %.
      const delay = Math.min(max, base * 2 ** (attempt - 1));
      const jittered = Math.round(delay * (1 + Math.random() * 0.3));
      logger.warn(
        { err: error, operation: options.operation, attempt, nextRetryInMs: jittered },
        'error transitorio en servicio externo: se reintenta',
      );
      await sleep(jittered);
    }
  }
  throw lastError;
}
