import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Identificador por petición: enlaza logs, auditoría y respuestas de error. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.requestId = (typeof incoming === 'string' && incoming.length <= 64 ? incoming : null) ?? randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};
