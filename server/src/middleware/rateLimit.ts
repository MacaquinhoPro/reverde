/**
 * Límite de peticiones por ventana deslizante, en memoria del proceso.
 *
 * Suficiente para una sola instancia; con varias réplicas hay que moverlo a
 * Redis (ver docs/ARCHITECTURE.md § límites conocidos). La protección de
 * fuerza bruta contra el login **no** depende de esto: está en la base de
 * datos (tabla LoginAttempt), así que sobrevive a reinicios y réplicas.
 */
import type { RequestHandler } from 'express';
import { env } from '../config/env.ts';
import { tooMany } from '../lib/errors.ts';
import { clientIp } from '../lib/http.ts';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpieza periódica para que el mapa no crezca sin control.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 60_000);
sweeper.unref();

export function rateLimit(options: { max?: number; windowSeconds?: number; keyPrefix?: string } = {}): RequestHandler {
  const max = options.max ?? env.RATE_LIMIT_MAX;
  const windowMs = (options.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS) * 1000;
  const prefix = options.keyPrefix ?? 'global';

  return (req, res, next) => {
    const key = `${prefix}:${req.auth?.user.id ?? clientIp(req)}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('x-ratelimit-remaining', String(max - 1));
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('retry-after', String(retryAfter));
      return next(tooMany(`Demasiadas peticiones. Intenta de nuevo en ${retryAfter} s.`));
    }
    res.setHeader('x-ratelimit-remaining', String(Math.max(0, max - bucket.count)));
    next();
  };
}

/** Para las pruebas: deja los contadores limpios entre casos. */
export const resetRateLimits = () => buckets.clear();
