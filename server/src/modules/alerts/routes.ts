import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { notFound } from '../../lib/errors.ts';
import { alertDTO, productDTO } from '../../domain/serialize.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';
import { resolveEstablishment } from '../../middleware/tenancy.ts';
import { syncIntelligence } from '../inventory/service.ts';

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

const listQuery = paginationSchema.extend({
  establishmentId: z.string().uuid().optional(),
  level: z.enum(['bajo', 'medio', 'alto']).optional(),
  status: z.enum(['abierta', 'silenciada', 'resuelta', 'todas']).default('abierta'),
  includeProduct: z.coerce.boolean().default(true),
});

/**
 * Alertas de vencimiento. Antes de responder se recalcula el Risk Score de
 * todo el inventario: así una alerta nunca queda desfasada del stock real.
 */
alertsRouter.get(
  '/',
  requirePermission('alerts:read'),
  validate({ query: listQuery }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    await syncIntelligence(req.establishmentId!);

    const now = new Date();
    const where = {
      establishmentId: req.establishmentId!,
      ...(q.level ? { level: q.level } : {}),
      ...(q.status === 'todas'
        ? {}
        : q.status === 'abierta'
          ? // Una alerta silenciada vuelve a la bandeja cuando vence el silencio.
            { OR: [{ status: 'abierta' as const }, { status: 'silenciada' as const, snoozedUntil: { lte: now } }] }
          : { status: q.status }),
    };

    const [rows, total] = await Promise.all([
      prisma.expirationAlert.findMany({
        where,
        // El producto siempre se trae: la bandeja lo necesita para pintar la
        // ficha. `includeProduct=false` solo lo omite de la respuesta.
        include: { product: { include: { inventory: true } } },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(q),
      }),
      prisma.expirationAlert.count({ where }),
    ]);

    return paginated(
      res,
      rows.map((a) => ({
        ...alertDTO(a),
        product: q.includeProduct ? productDTO(a.product, { risk: true }) : undefined,
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/** Conteo rápido por nivel: alimenta los contadores de la navegación. */
alertsRouter.get(
  '/counts',
  requirePermission('alerts:read'),
  validate({ query: z.object({ establishmentId: z.string().uuid().optional() }) }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    await syncIntelligence(req.establishmentId!);
    const now = new Date();
    const grouped = await prisma.expirationAlert.groupBy({
      by: ['level'],
      where: {
        establishmentId: req.establishmentId!,
        OR: [{ status: 'abierta' }, { status: 'silenciada', snoozedUntil: { lte: now } }],
      },
      _count: { _all: true },
    });
    const counts = { alto: 0, medio: 0, bajo: 0, total: 0 };
    for (const g of grouped) {
      counts[g.level as 'alto' | 'medio' | 'bajo'] = g._count._all;
      counts.total += g._count._all;
    }
    return ok(res, counts);
  }),
);

/** Carga una alerta propia por id de alerta o de producto. */
async function loadOwnAlert(req: Request) {
  const alert = await prisma.expirationAlert.findFirst({
    where: { OR: [{ id: param(req, 'id') }, { productId: param(req, 'id') }] },
  });
  if (!alert) throw notFound('La alerta no existe.');
  if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(alert.establishmentId)) {
    throw notFound('La alerta no existe.');
  }
  return alert;
}

/** Silenciar: la alerta desaparece de la bandeja por N horas. */
alertsRouter.post(
  '/:id/snooze',
  requirePermission('alerts:write'),
  validate({ body: z.object({ hours: z.coerce.number().int().min(1).max(720).default(24) }) }),
  asyncHandler(async (req, res) => {
    const alert = await loadOwnAlert(req);
    const updated = await prisma.expirationAlert.update({
      where: { id: alert.id },
      data: { status: 'silenciada', snoozedUntil: new Date(Date.now() + req.body.hours * 3_600_000) },
    });
    await audit(req, {
      action: 'alert.snoozed',
      entity: 'ExpirationAlert',
      entityId: alert.id,
      establishmentId: alert.establishmentId,
      metadata: { hours: req.body.hours },
    });
    return ok(res, alertDTO(updated));
  }),
);

alertsRouter.post(
  '/:id/resolve',
  requirePermission('alerts:write'),
  asyncHandler(async (req, res) => {
    const alert = await loadOwnAlert(req);
    const updated = await prisma.expirationAlert.update({
      where: { id: alert.id },
      data: { status: 'resuelta', resolvedAt: new Date(), snoozedUntil: null },
    });
    await audit(req, {
      action: 'alert.resolved',
      entity: 'ExpirationAlert',
      entityId: alert.id,
      establishmentId: alert.establishmentId,
    });
    return ok(res, alertDTO(updated));
  }),
);
