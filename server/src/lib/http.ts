/** Utilidades de respuesta, validación y paginación. */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { badRequest } from './errors.ts';

/** Envuelve un handler async para que los rechazos lleguen al middleware de error. */
export const asyncHandler =
  <T extends RequestHandler>(fn: T): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201);
}

export function paginated<T>(res: Response, items: T[], meta: { page: number; pageSize: number; total: number }) {
  return res.json({
    data: items,
    meta: { ...meta, totalPages: Math.max(1, Math.ceil(meta.total / meta.pageSize)) },
  });
}

/** Valida body/query/params y reemplaza el valor por el dato ya tipado. */
export const validate =
  <B extends z.ZodTypeAny, Q extends z.ZodTypeAny, P extends z.ZodTypeAny>(schemas: {
    body?: B;
    query?: Q;
    params?: P;
  }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    for (const source of ['body', 'query', 'params'] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        return next(
          badRequest(
            'Los datos enviados no son válidos.',
            result.error.issues.map((i) => ({ campo: i.path.join('.') || source, mensaje: i.message })),
          ),
        );
      }
      if (source === 'query') {
        // En Express 5 req.query es un getter: se guarda aparte.
        (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
      } else {
        req[source] = result.data as never;
      }
    }
    next();
  };

/** Query ya validada por `validate`. */
export const query = <T>(req: Request): T => (req as Request & { validatedQuery?: T }).validatedQuery as T;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const skipTake = (p: { page: number; pageSize: number }) => ({
  skip: (p.page - 1) * p.pageSize,
  take: p.pageSize,
});

/**
 * Parámetro de ruta como cadena. Express tipa `req.params` como
 * `string | string[]` (por los comodines), y casi siempre queremos la cadena.
 */
export const param = (req: Request, key: string): string => {
  const value = req.params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
};

/** Primera IP real detrás de un proxy de confianza. */
export const clientIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || 'unknown';
