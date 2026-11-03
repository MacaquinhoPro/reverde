/**
 * Aislamiento por establecimiento (multi-tenant).
 *
 * Toda consulta de un administrador de establecimiento se filtra por el
 * establecimiento al que pertenece su cuenta, resuelto aquí a partir de la
 * tabla EstablishmentUser. Nunca se toma el establecimiento de un parámetro de
 * la petición, salvo para el superadministrador.
 */
import type { RequestHandler } from 'express';
import { forbidden, notFound, unauthorized } from '../lib/errors.ts';
import { prisma } from '../lib/prisma.ts';

/** Resuelve `req.establishmentId` o falla. Superadmin puede indicarlo. */
export const resolveEstablishment: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());

  const requested =
    (req.params.establishmentId as string | undefined) ??
    (req.query.establishmentId as string | undefined) ??
    (typeof req.body === 'object' && req.body !== null
      ? ((req.body as Record<string, unknown>).establishmentId as string | undefined)
      : undefined);

  if (req.auth.user.role === 'superadmin') {
    if (!requested) return next(forbidden('Indica el establecimiento con ?establishmentId='));
    prisma.establishment
      .findUnique({ where: { id: requested }, select: { id: true } })
      .then((est) => {
        if (!est) return next(notFound('El establecimiento no existe.'));
        req.establishmentId = est.id;
        next();
      })
      .catch(next);
    return;
  }

  const own = req.auth.user.establishmentIds;
  if (own.length === 0) {
    return next(forbidden('Tu cuenta todavía no está asociada a un establecimiento.'));
  }
  // Pedir otro establecimiento no devuelve 404 (eso confirmaría su existencia):
  // es un 403 directo.
  if (requested && !own.includes(requested)) {
    return next(forbidden('No tienes acceso a los datos de ese establecimiento.'));
  }
  req.establishmentId = requested ?? own[0];
  next();
};

/** Garantiza que un recurso pertenece al establecimiento de la petición. */
export function assertSameEstablishment(req: { establishmentId?: string; auth?: { user: { role: string } } }, establishmentId: string): void {
  if (req.auth?.user.role === 'superadmin') return;
  if (req.establishmentId !== establishmentId) {
    throw forbidden('El recurso pertenece a otro establecimiento.');
  }
}
