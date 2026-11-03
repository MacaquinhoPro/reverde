import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.ts';
import { logger } from '../lib/logger.ts';
import { env } from '../config/env.ts';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No existe la ruta ${req.method} ${req.path}` } });
};

/**
 * Manejo centralizado de errores. Hacia afuera solo salen códigos y mensajes
 * pensados para la persona usuaria; el detalle técnico queda en el log.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, requestId: req.requestId }, err.message);
    else logger.debug({ code: err.code, requestId: req.requestId }, err.message);
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'conflict', message: 'Ya existe un registro con esos datos.', details: err.meta?.target },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'not_found', message: 'El registro no existe.' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: { code: 'conflict', message: 'El registro está referenciado por otros datos.' } });
      return;
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'bad_request', message: 'El cuerpo de la petición no es JSON válido.' } });
    return;
  }

  logger.error({ err, requestId: req.requestId }, 'error no controlado');
  res.status(500).json({
    error: {
      code: 'server_error',
      message: 'Ocurrió un error inesperado.',
      // El stack solo se expone fuera de producción.
      details: env.isProd ? undefined : (err as Error)?.message,
    },
  });
};
