/**
 * Protección CSRF por doble envío de cookie.
 *
 * Como la autenticación va en cookie, un sitio externo podría provocar una
 * petición autenticada. El frontend lee la cookie `rv_csrf` (no es HttpOnly) y
 * la repite en el encabezado `x-csrf-token`; un atacante en otro origen no
 * puede leer la cookie, así que no puede construir el encabezado.
 *
 * El webhook de la pasarela está exento: no lo origina un navegador y su
 * autenticidad se verifica con la firma del proveedor.
 */
import type { RequestHandler } from 'express';
import { env } from '../config/env.ts';
import { forbidden } from '../lib/errors.ts';
import { safeEqual } from '../lib/crypto.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookie = req.cookies?.[env.CSRF_COOKIE_NAME];
  const header = req.headers['x-csrf-token'];

  // Sin cookie de sesión no hay nada que proteger (login, registro, etc.).
  if (!req.cookies?.[env.SESSION_COOKIE_NAME]) return next();

  if (typeof cookie !== 'string' || typeof header !== 'string' || !cookie || !safeEqual(cookie, header)) {
    return next(forbidden('Token CSRF inválido o ausente. Recarga la página e intenta de nuevo.'));
  }
  next();
};
