/**
 * Utilidades de desarrollo. Este router solo se monta cuando NODE_ENV no es
 * `production`; además cada endpoint vuelve a comprobarlo, para que un error
 * de configuración no lo exponga por accidente.
 */
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.ts';
import { prisma } from '../lib/prisma.ts';
import { asyncHandler, ok, validate } from '../lib/http.ts';
import { forbidden } from '../lib/errors.ts';
import { sentMails } from '../lib/mailer.ts';
import { expireProducts, syncIntelligence } from './inventory/service.ts';
import { expireStaleOrders } from './orders/service.ts';

export const devRouter = Router();

devRouter.use((_req, _res, next) => {
  if (env.isProd) return next(forbidden('No disponible.'));
  next();
});

/** Cuentas de demostración disponibles, para la pantalla de acceso rápido. */
devRouter.get(
  '/demo-accounts',
  asyncHandler(async (_req, res) => {
    if (!env.demoEnabled) return ok(res, { enabled: false, password: null, accounts: [] });
    const users = await prisma.user.findMany({
      where: { isDemo: true, deletedAt: null },
      include: { memberships: { include: { establishment: { select: { id: true, name: true } } } } },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
    return ok(res, {
      enabled: true,
      password: env.DEMO_PASSWORD ?? null,
      accounts: users.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role as string,
        establishmentId: u.memberships[0]?.establishmentId,
        establishmentName: u.memberships[0]?.establishment.name,
      })),
    });
  }),
);

/** Últimos correos "enviados" con el transporte de log. */
devRouter.get('/mails', (_req, res) => ok(res, sentMails.slice(-20).reverse()));

/** Fuerza los trabajos programados (vencer órdenes y productos, recalcular). */
devRouter.post(
  '/run-jobs',
  asyncHandler(async (_req, res) => {
    const orders = await expireStaleOrders();
    const products = await expireProducts();
    const establishments = await prisma.establishment.findMany({ select: { id: true } });
    for (const e of establishments) await syncIntelligence(e.id);
    return ok(res, { expiredOrders: orders, expiredProducts: products, establishments: establishments.length });
  }),
);

/** Aprueba o rechaza un pago simulado sin pasar por el navegador. */
devRouter.post(
  '/pay',
  validate({ body: z.object({ orderId: z.string().uuid(), status: z.enum(['APPROVED', 'DECLINED']).default('APPROVED') }) }),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { orderId: req.body.orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) return ok(res, { outcome: 'sin_pago' });
    const { buildMockEvent } = await import('./payments/mock.ts');
    const { processProviderEvent } = await import('./payments/service.ts');
    const { gateway } = await import('./payments/index.ts');
    const event = buildMockEvent({
      transactionId: `devtx-${payment.id.slice(0, 8)}-${req.body.status}`,
      reference: payment.reference,
      status: req.body.status,
      amountInCents: payment.amountInCents,
    });
    const parsed = gateway().parseEvent(Buffer.from(JSON.stringify(event)), {});
    return ok(res, { outcome: await processProviderEvent(parsed) });
  }),
);
