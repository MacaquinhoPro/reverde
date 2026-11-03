/**
 * Fábrica de la aplicación Express. Se exporta sin arrancar el servidor para
 * que las pruebas de integración puedan montarla con supertest.
 */
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.ts';
import { logger } from './lib/logger.ts';
import { prisma } from './lib/prisma.ts';
import { ok } from './lib/http.ts';
import { attachSession } from './middleware/auth.ts';
import { csrfProtection } from './middleware/csrf.ts';
import { errorHandler, notFoundHandler } from './middleware/error.ts';
import { rateLimit } from './middleware/rateLimit.ts';
import { requestId } from './middleware/requestId.ts';
import { openApiDocument } from './openapi.ts';

import { authRouter } from './modules/auth/routes.ts';
import { usersRouter } from './modules/users/routes.ts';
import { establishmentsRouter } from './modules/establishments/routes.ts';
import { productsRouter } from './modules/products/routes.ts';
import { inventoryRouter } from './modules/inventory/routes.ts';
import { alertsRouter } from './modules/alerts/routes.ts';
import { recommendationsRouter } from './modules/recommendations/routes.ts';
import { marketplaceRouter } from './modules/marketplace/routes.ts';
import { cartRouter } from './modules/cart/routes.ts';
import { ordersRouter } from './modules/orders/routes.ts';
import { paymentsRouter, paymentsWebhookRouter } from './modules/payments/routes.ts';
import { dashboardRouter } from './modules/dashboard/routes.ts';
import { notificationsRouter } from './modules/notifications/routes.ts';
import { adminRouter } from './modules/admin/routes.ts';
import { devRouter } from './modules/dev.ts';

export function createApp(): Express {
  const app = express();

  // Detrás de un proxy (Vercel, Render, Nginx) para leer la IP real y saber
  // que la conexión original era HTTPS.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    helmet({
      // La API responde JSON; la política de contenido la aplica el frontend.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: env.isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      // Lista blanca explícita: las cookies de sesión exigen origen conocido.
      origin(origin, callback) {
        if (!origin) return callback(null, true); // curl, webhooks, same-origin
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        if (!env.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
        return callback(new Error(`Origen no permitido: ${origin}`));
      },
      credentials: true,
      exposedHeaders: ['x-request-id', 'x-unread-count', 'x-ratelimit-remaining', 'idempotent-replay'],
    }),
  );

  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as { requestId?: string }).requestId ?? '',
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      }),
    );
  }

  /**
   * El webhook necesita el cuerpo crudo para validar la firma, así que se
   * registra ANTES del parser de JSON y queda fuera de CSRF.
   */
  app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '256kb' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return ok(res, { status: 'ok', env: env.NODE_ENV, database: 'ok', payments: env.PAYMENTS_PROVIDER });
    } catch {
      return res.status(503).json({ error: { code: 'unavailable', message: 'La base de datos no responde.' } });
    }
  });

  // Solo el webhook se monta antes de la sesión y del CSRF.
  app.use('/api/payments', paymentsWebhookRouter);

  app.use(attachSession);
  app.use(csrfProtection);
  app.use(rateLimit());

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/establishments', establishmentsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/marketplace', marketplaceRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);

  // Utilidades de desarrollo (reiniciar demo, ver correos). Nunca en producción.
  if (!env.isProd) app.use('/api/dev', devRouter);

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'API Reverde' }));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
