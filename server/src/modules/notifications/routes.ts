import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { notificationDTO } from '../../domain/serialize.ts';
import { requireAuth } from '../../middleware/auth.ts';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

/** Notificaciones propias y las de los establecimientos que administra. */
notificationsRouter.get(
  '/',
  validate({ query: paginationSchema.extend({ unread: z.coerce.boolean().optional() }) }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; unread?: boolean }>(req);
    const scopes = [
      { userId: req.auth!.user.id },
      ...(req.auth!.user.establishmentIds.length
        ? [{ establishmentId: { in: req.auth!.user.establishmentIds } }]
        : []),
      // Las notificaciones sin destinatario son de la plataforma.
      ...(req.auth!.user.role === 'superadmin' ? [{ userId: null, establishmentId: null }] : []),
    ];
    const where = { OR: scopes, ...(q.unread ? { readAt: null } : {}) };
    const [rows, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { OR: scopes, readAt: null } }),
    ]);
    res.setHeader('x-unread-count', String(unread));
    return paginated(res, rows.map(notificationDTO), { page: q.page, pageSize: q.pageSize, total });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: {
        id: param(req, 'id'),
        OR: [
          { userId: req.auth!.user.id },
          { establishmentId: { in: req.auth!.user.establishmentIds } },
        ],
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return ok(res, { message: 'Notificación marcada como leída.' });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: {
        OR: [{ userId: req.auth!.user.id }, { establishmentId: { in: req.auth!.user.establishmentIds } }],
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return ok(res, { updated: result.count });
  }),
);
