import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, created, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { forbidden, notFound } from '../../lib/errors.ts';
import { orderDTO } from '../../domain/serialize.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission, requireRole } from '../../middleware/rbac.ts';
import { resolveEstablishment } from '../../middleware/tenancy.ts';
import { idempotency } from '../../middleware/idempotency.ts';
import { createOrderFromCart, loadOrder, failOrder, markDelivered, startCheckout } from './service.ts';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const createSchema = z.object({
  mode: z.enum(['compra', 'reserva']).default('compra'),
  /**
   * El método es una intención: el cobro real y el método definitivo los
   * confirma la pasarela. `establecimiento` es el único que no la usa.
   */
  paymentMethod: z.enum(['tarjeta', 'pse', 'nequi', 'bancolombia', 'establecimiento']).default('tarjeta'),
  /**
   * Autorización de tratamiento de datos del pedido. Se guarda como prueba
   * (Ley 1581 de 2012); la fecha la sella el servidor.
   */
  consent: z
    .object({
      version: z.string().trim().min(1).max(40),
      purpose: z.string().trim().min(1).max(300),
      acceptedAt: z.string().optional(),
    })
    .optional(),
});

/**
 * Crea el pedido a partir del carrito guardado. No acepta precios, productos
 * ni totales del cliente: todo sale de la base de datos.
 */
ordersRouter.post(
  '/',
  requirePermission('orders:create'),
  validate({ body: createSchema }),
  idempotency('orders:create'),
  asyncHandler(async (req, res) => {
    const { mode, paymentMethod } = req.body as z.infer<typeof createSchema>;
    const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;

    const order = await createOrderFromCart({
      userId: req.auth!.user.id,
      mode,
      paymentMethod,
      idempotencyKey,
      consent: req.body.consent
        ? { ...req.body.consent, acceptedAt: new Date().toISOString() }
        : undefined,
    });

    await audit(req, {
      action: 'order.created',
      entity: 'Order',
      entityId: order.id,
      metadata: { code: order.code, total: order.totalCop, mode, paymentMethod },
    });
    return created(res, orderDTO(order));
  }),
);

/** Inicia el checkout alojado de la pasarela. */
ordersRouter.post(
  '/:id/checkout',
  requirePermission('payments:checkout'),
  idempotency('orders:checkout'),
  asyncHandler(async (req, res) => {
    const result = await startCheckout(param(req, 'id'), req.auth!.user.id);
    await audit(req, {
      action: 'order.checkout_started',
      entity: 'Order',
      entityId: param(req, 'id'),
      metadata: { reference: result.reference },
    });
    return ok(res, { order: orderDTO(result.order), checkoutUrl: result.checkoutUrl, reference: result.reference });
  }),
);

const listQuery = paginationSchema.extend({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED']).optional(),
  mode: z.enum(['compra', 'reserva']).optional(),
});

/** Mis pedidos. */
ordersRouter.get(
  '/',
  requirePermission('orders:read:own'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    const where = {
      userId: req.auth!.user.id,
      ...(q.status ? { status: q.status } : {}),
      ...(q.mode ? { mode: q.mode } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: { select: { name: true, email: true } }, payments: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.order.count({ where }),
    ]);
    return paginated(res, rows.map(orderDTO), { page: q.page, pageSize: q.pageSize, total });
  }),
);

/** Pedidos que llegan a un establecimiento. */
ordersRouter.get(
  '/establishment',
  requirePermission('orders:read:establishment'),
  validate({ query: listQuery.extend({ establishmentId: z.string().uuid().optional() }) }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    const where: Prisma.OrderWhereInput = {
      items: { some: { establishmentId: req.establishmentId! } },
      // Por defecto solo lo que el establecimiento tiene que atender.
      status: q.status ?? { in: ['PENDING_PAYMENT', 'PAID'] },
      ...(q.mode ? { mode: q.mode } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: { select: { name: true, email: true } }, payments: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.order.count({ where }),
    ]);
    return paginated(
      res,
      // El establecimiento solo ve las líneas que le corresponden.
      rows.map((o) => ({
        ...orderDTO({ ...o, items: o.items.filter((i) => i.establishmentId === req.establishmentId) }),
        allEstablishments: [...new Set(o.items.map((i) => i.establishmentId))].length,
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: param(req, 'id') },
      include: { items: true, user: { select: { name: true, email: true } }, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw notFound('El pedido no existe.');

    const role = req.auth!.user.role;
    const own = order.userId === req.auth!.user.id;
    const mine = order.items.some((i) => req.auth!.user.establishmentIds.includes(i.establishmentId));
    if (!own && !mine && role !== 'superadmin') throw notFound('El pedido no existe.');

    // Un establecimiento solo ve sus líneas; la persona compradora, todas.
    const items = own || role === 'superadmin'
      ? order.items
      : order.items.filter((i) => req.auth!.user.establishmentIds.includes(i.establishmentId));
    return ok(res, orderDTO({ ...order, items }));
  }),
);

/** Cancelar un pedido propio que aún no se pagó: libera el stock. */
ordersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: param(req, 'id') },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw notFound('El pedido no existe.');
    const isOwner = order.userId === req.auth!.user.id;
    if (!isOwner && req.auth!.user.role !== 'superadmin') throw notFound('El pedido no existe.');
    if (order.status !== 'PENDING_PAYMENT') {
      throw forbidden('Solo se pueden cancelar pedidos pendientes de pago.');
    }

    await failOrder(
      order.id,
      order.payments[0]?.id ?? null,
      'CANCELLED',
      'VOIDED',
      'Cancelado por la persona compradora',
    );
    await audit(req, { action: 'order.cancelled', entity: 'Order', entityId: order.id });
    return ok(res, orderDTO(await loadOrder(order.id)));
  }),
);

/** Entrega del pedido. Si era pago en el local, aquí se registra la venta. */
ordersRouter.post(
  '/:id/deliver',
  requirePermission('orders:manage'),
  asyncHandler(async (req, res) => {
    const establishmentIds =
      req.auth!.user.role === 'superadmin'
        ? (await prisma.orderItem.findMany({ where: { orderId: param(req, 'id') }, select: { establishmentId: true } })).map(
            (i) => i.establishmentId,
          )
        : req.auth!.user.establishmentIds;

    const order = await markDelivered(param(req, 'id'), establishmentIds, req.auth!.user.id);
    await audit(req, { action: 'order.delivered', entity: 'Order', entityId: order.id, metadata: { code: order.code } });
    return ok(res, orderDTO(await loadOrder(order.id)));
  }),
);

/** Vista global de pedidos para el superadministrador. */
ordersRouter.get(
  '/admin/all',
  requireRole('superadmin'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    const where = { ...(q.status ? { status: q.status } : {}), ...(q.mode ? { mode: q.mode } : {}) };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: { select: { name: true, email: true } }, payments: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.order.count({ where }),
    ]);
    return paginated(res, rows.map(orderDTO), { page: q.page, pageSize: q.pageSize, total });
  }),
);
