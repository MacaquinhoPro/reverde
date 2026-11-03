/**
 * Autenticación por cookie de sesión.
 *
 * El token de sesión es opaco y aleatorio (32 bytes). En la base de datos solo
 * vive su SHA-256, así que una filtración de la tabla no permite suplantar a
 * nadie. La cookie es HttpOnly (inaccesible a JavaScript), Secure en
 * producción y SameSite configurable.
 */
import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.ts';
import { prisma } from '../lib/prisma.ts';
import { hashIp, randomToken, sha256 } from '../lib/crypto.ts';
import { clientIp } from '../lib/http.ts';
import { forbidden, unauthorized } from '../lib/errors.ts';

const SESSION_TTL_MS = () => env.SESSION_TTL_HOURS * 3_600_000;

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

/** Crea la sesión, la guarda hasheada y deja las cookies en la respuesta. */
export async function issueSession(req: Request, res: Response, userId: string): Promise<string> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS());

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ipHash: hashIp(clientIp(req)),
      userAgent: req.headers['user-agent']?.slice(0, 250) ?? null,
    },
  });

  res.cookie(env.SESSION_COOKIE_NAME, token, { ...baseCookie(), expires: expiresAt });
  // La cookie CSRF sí es legible por el frontend: es la mitad del doble envío.
  res.cookie(env.CSRF_COOKIE_NAME, csrf, { ...baseCookie(), httpOnly: false, expires: expiresAt });
  return session.id;
}

export async function revokeSession(res: Response, sessionId?: string): Promise<void> {
  if (sessionId) {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(env.SESSION_COOKIE_NAME, baseCookie());
  res.clearCookie(env.CSRF_COOKIE_NAME, { ...baseCookie(), httpOnly: false });
}

/** Cierra todas las sesiones de una persona (cambio de contraseña, bloqueo). */
export const revokeAllSessions = (userId: string) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

async function resolve(req: Request): Promise<Request['auth'] | null> {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (!token || typeof token !== 'string') return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { memberships: { select: { establishmentId: true } } } } },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (session.user.deletedAt || session.user.status === 'suspendido') return null;

  // Renovación deslizante: solo se escribe si pasó más de 5 minutos, para no
  // generar un UPDATE por cada petición.
  if (Date.now() - session.lastUsedAt.getTime() > 300_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS()) },
    });
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      emailVerified: session.user.emailVerifiedAt !== null,
      establishmentIds: session.user.memberships.map((m) => m.establishmentId),
    },
  };
}

/** Adjunta la sesión si existe, sin exigirla. */
export const attachSession: RequestHandler = (req, _res, next) => {
  resolve(req)
    .then((auth) => {
      if (auth) req.auth = auth;
      next();
    })
    .catch(next);
};

/** Exige sesión válida. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.auth) return next();
  next(unauthorized());
};

/** Exige correo verificado (se usa en pagos y publicación de productos). */
export const requireVerifiedEmail: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  if (req.auth.user.emailVerified) return next();
  next(forbidden('Confirma tu correo electrónico para completar esta acción.'));
};
