/**
 * Idempotencia para operaciones que mueven dinero o inventario.
 *
 * El cliente manda `Idempotency-Key`. Si la misma clave llega otra vez con el
 * mismo cuerpo, se devuelve la respuesta guardada en lugar de volver a
 * ejecutar; si llega con un cuerpo distinto, se rechaza con 409. Así un doble
 * clic o un reintento de red no crea dos órdenes ni dos cobros.
 */
import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.ts';
import { conflict } from '../lib/errors.ts';
import { logger } from '../lib/logger.ts';

const TTL_HOURS = 24;

export const idempotency =
  (scope: string): RequestHandler =>
  (req, res, next) => {
    const header = req.headers['idempotency-key'];
    const key = typeof header === 'string' && header.trim() ? `${scope}:${header.trim()}` : null;
    if (!key) return next();

    const requestHash = createHash('sha256')
      .update(JSON.stringify({ body: req.body ?? {}, user: req.auth?.user.id ?? null }))
      .digest('hex');

    prisma.idempotencyRecord
      .findUnique({ where: { key } })
      .then((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            return next(conflict('Esa clave de idempotencia ya se usó con datos distintos.'));
          }
          if (existing.responseStatus) {
            res.setHeader('idempotent-replay', 'true');
            return res.status(existing.responseStatus).json(existing.responseBody);
          }
          // Hay otra petición en curso con la misma clave.
          return next(conflict('La operación con esa clave todavía se está procesando.'));
        }

        return prisma.idempotencyRecord
          .create({
            data: {
              key,
              scope,
              userId: req.auth?.user.id ?? null,
              requestHash,
              expiresAt: new Date(Date.now() + TTL_HOURS * 3_600_000),
            },
          })
          .then(() => {
            // Se intercepta la respuesta para guardarla junto a la clave.
            const json = res.json.bind(res);
            res.json = (body: unknown) => {
              if (res.statusCode < 500) {
                prisma.idempotencyRecord
                  .update({
                    where: { key },
                    data: { responseStatus: res.statusCode, responseBody: body as object },
                  })
                  .catch((err) => logger.warn({ err, key }, 'no se pudo guardar la respuesta idempotente'));
              } else {
                // Un 5xx no se cachea: el cliente debe poder reintentar.
                prisma.idempotencyRecord.delete({ where: { key } }).catch(() => {});
              }
              return json(body);
            };
            next();
          });
      })
      .catch(next);
  };
