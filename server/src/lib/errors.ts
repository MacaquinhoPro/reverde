/** Errores de dominio con código HTTP. El middleware central los traduce. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Necesitas iniciar sesión.') => new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'No tienes permiso para esta acción.') => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Recurso no encontrado.') => new AppError(404, 'not_found', message);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'conflict', message, details);
export const unprocessable = (message: string, details?: unknown) => new AppError(422, 'unprocessable', message, details);
export const tooMany = (message = 'Demasiados intentos. Espera un momento.') => new AppError(429, 'rate_limited', message);
export const serverError = (message = 'Error interno.') => new AppError(500, 'server_error', message);
