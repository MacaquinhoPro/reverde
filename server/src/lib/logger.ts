/**
 * Logs estructurados. La lista `redact` evita que una contraseña, un token o
 * una cookie terminen en un archivo de log por accidente.
 */
import pino from 'pino';
import { env } from '../config/env.ts';

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'reverde-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'token',
      'tokenHash',
      'card',
      'cardNumber',
      'cvv',
      '*.password',
      '*.token',
      '*.cvv',
      'body.password',
      'body.token',
    ],
    censor: '[redactado]',
  },
  transport: env.LOG_PRETTY && !env.isProd ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } : undefined,
});
