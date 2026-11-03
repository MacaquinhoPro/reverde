/** Panel del superadministrador: plataforma, usuarios y solicitudes. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, created, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import { establishmentDTO, userDTO } from '../../domain/serialize.ts';
import { co2FromKg, waterFromKg } from '../../domain/risk.ts';
import { requireAuth, revokeAllSessions } from '../../middleware/auth.ts';
import { requireRole } from '../../middleware/rbac.ts';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('superadmin'));

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);

/** Resumen global de la plataforma. */
adminRouter.get(
  '/overview',
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
  asyncHandler(async (req, res) => {
    const { days } = query<{ days: number }>(req);
    const since = new Date(Date.now() - days * 86_400_000);

    const [
      establishments,
      activeEstablishments,
      users,
      buyers,
      products,
      published,
      salesAgg,
      ordersCount,
      paidOrders,
      pendingRequests,
      topEstablishments,
    ] = await Promise.all([
      prisma.establishment.count(),
      prisma.establishment.count({ where: { status: 'activo' } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: 'cliente' } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null, status: 'publicado' } }),
      prisma.sale.aggregate({
        where: { occurredAt: { gte: since } },
        _sum: { recovered: true, wasteAvoidedKg: true, quantity: true },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.count({ where: { createdAt: { gte: since }, status: 'PAID' } }),
      prisma.establishmentRequest.count({ where: { status: 'pendiente' } }),
      prisma.sale.groupBy({
        by: ['establishmentId'],
        where: { occurredAt: { gte: since } },
        _sum: { recovered: true, wasteAvoidedKg: true },
        orderBy: { _sum: { recovered: 'desc' } },
        take: 5,
      }),
    ]);

    const names = await prisma.establishment.findMany({
      where: { id: { in: topEstablishments.map((t) => t.establishmentId) } },
      select: { id: true, name: true, type: true },
    });
    const wasteKg = +(salesAgg._sum.wasteAvoidedKg ?? 0).toFixed(2);

    return ok(res, {
      period: { days, from: since.toISOString() },
      establishments: { total: establishments, active: activeEstablishments, pendingRequests },
      users: { total: users, buyers, operators: users - buyers },
      catalog: { products, published },
      impact: {
        rescued: salesAgg._sum.quantity ?? 0,
        wasteAvoidedKg: wasteKg,
        recovered: salesAgg._sum.recovered ?? 0,
        sales: salesAgg._count._all,
        co2AvoidedKg: co2FromKg(wasteKg),
        waterSavedL: waterFromKg(wasteKg),
      },
      orders: { total: ordersCount, paid: paidOrders, conversion: ordersCount ? (paidOrders / ordersCount) * 100 : 0 },
      topEstablishments: topEstablishments.map((t) => ({
        ...names.find((n) => n.id === t.establishmentId),
        recovered: t._sum.recovered ?? 0,
        wasteAvoidedKg: +(t._sum.wasteAvoidedKg ?? 0).toFixed(1),
      })),
    });
  }),
);

/** Establecimientos con sus métricas, para la tabla del panel. */
adminRouter.get(
  '/establishments',
  validate({ query: paginationSchema.extend({ status: z.enum(['activo', 'pendiente', 'suspendido']).optional() }) }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; status?: string }>(req);
    const where = q.status ? { status: q.status as never } : {};
    const [rows, total] = await Promise.all([
      prisma.establishment.findMany({
        where,
        include: {
          _count: { select: { products: true, members: true } },
          sales: { select: { recovered: true, wasteAvoidedKg: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.establishment.count({ where }),
    ]);
    return paginated(
      res,
      rows.map((e) => ({
        ...establishmentDTO(e),
        productCount: e._count.products,
        memberCount: e._count.members,
        recovered: e.sales.reduce((s, v) => s + v.recovered, 0),
        wasteAvoidedKg: +e.sales.reduce((s, v) => s + v.wasteAvoidedKg, 0).toFixed(1),
        rescued: e.sales.reduce((s, v) => s + v.quantity, 0),
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/** Publicaciones activas en toda la plataforma. */
adminRouter.get(
  '/listings',
  validate({ query: paginationSchema.extend({ status: z.enum(['activa', 'pausada', 'agotada']).optional() }) }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; status?: string }>(req);
    const where = q.status ? { status: q.status as never } : {};
    const [rows, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        include: {
          product: { include: { inventory: true } },
          establishment: { select: { id: true, name: true, type: true, city: true } },
        },
        orderBy: { publishedAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.marketplaceListing.count({ where }),
    ]);
    return paginated(
      res,
      rows.map((l) => ({
        id: l.id,
        status: l.status as string,
        featured: l.featured,
        publishedAt: l.publishedAt.toISOString(),
        product: {
          id: l.product.id,
          name: l.product.name,
          category: l.product.category,
          emoji: l.product.emoji,
          photo: l.product.photo,
          originalPrice: l.product.originalPrice,
          discountPercent: l.product.discountPercent,
          quantity: l.product.inventory?.quantity ?? 0,
          expiryDate: l.product.expiryDate.toISOString(),
        },
        establishment: l.establishment,
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/* ───────────── Solicitudes de cuenta de establecimiento ───────────── */

adminRouter.get(
  '/requests',
  validate({ query: paginationSchema.extend({ status: z.enum(['pendiente', 'aprobada', 'rechazada']).default('pendiente') }) }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; status: string }>(req);
    const where = { status: q.status as never };
    const [rows, total] = await Promise.all([
      prisma.establishmentRequest.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
        ...skipTake(q),
      }),
      prisma.establishmentRequest.count({ where }),
    ]);
    return paginated(
      res,
      rows.map((r) => ({
        id: r.id,
        name: r.establishmentName,
        type: r.type as string,
        address: r.address,
        city: r.city,
        schedule: r.schedule,
        status: r.status as string,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        requester: r.user,
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/**
 * Aprobar una solicitud crea el establecimiento, asocia a la persona como
 * propietaria y le cambia el rol. Es el único camino por el que alguien pasa
 * de comprador a administrador de establecimiento.
 */
adminRouter.post(
  '/requests/:id/approve',
  validate({ body: z.object({ notes: z.string().trim().max(400).optional() }) }),
  asyncHandler(async (req, res) => {
    const request = await prisma.establishmentRequest.findUnique({ where: { id: param(req, 'id') } });
    if (!request) throw notFound('La solicitud no existe.');
    if (request.status !== 'pendiente') throw conflict('La solicitud ya fue revisada.');

    const result = await prisma.$transaction(async (tx) => {
      const establishment = await tx.establishment.create({
        data: {
          slug: `${slugify(request.establishmentName)}-${Date.now().toString(36).slice(-4)}`,
          name: request.establishmentName,
          type: request.type,
          address: request.address,
          city: request.city,
          schedule: request.schedule,
          status: 'activo',
          joinedAt: new Date(),
        },
      });
      await tx.establishmentUser.create({
        data: { establishmentId: establishment.id, userId: request.userId, role: 'owner' },
      });
      await tx.user.update({ where: { id: request.userId }, data: { role: request.type } });
      await tx.establishmentRequest.update({
        where: { id: request.id },
        data: {
          status: 'aprobada',
          establishmentId: establishment.id,
          reviewedById: req.auth!.user.id,
          reviewedAt: new Date(),
          notes: req.body.notes ?? null,
        },
      });
      await tx.notification.create({
        data: {
          userId: request.userId,
          type: 'establishment_approved',
          title: 'Tu establecimiento fue aprobado',
          body: `${establishment.name} ya está activo en Reverde. Entra para cargar tu inventario.`,
          data: { establishmentId: establishment.id },
        },
      });
      return establishment;
    });

    // El rol cambió: las sesiones abiertas deben renovarse para reflejarlo.
    await revokeAllSessions(request.userId);
    await audit(req, {
      action: 'admin.request_approved',
      entity: 'EstablishmentRequest',
      entityId: request.id,
      establishmentId: result.id,
      metadata: { userId: request.userId },
    });
    return created(res, establishmentDTO(result));
  }),
);

adminRouter.post(
  '/requests/:id/reject',
  validate({ body: z.object({ notes: z.string().trim().min(3).max(400) }) }),
  asyncHandler(async (req, res) => {
    const request = await prisma.establishmentRequest.findUnique({ where: { id: param(req, 'id') } });
    if (!request) throw notFound('La solicitud no existe.');
    if (request.status !== 'pendiente') throw conflict('La solicitud ya fue revisada.');

    await prisma.$transaction([
      prisma.establishmentRequest.update({
        where: { id: request.id },
        data: { status: 'rechazada', reviewedById: req.auth!.user.id, reviewedAt: new Date(), notes: req.body.notes },
      }),
      prisma.notification.create({
        data: {
          userId: request.userId,
          type: 'establishment_rejected',
          title: 'Tu solicitud no fue aprobada',
          body: req.body.notes,
          data: { requestId: request.id },
        },
      }),
    ]);
    await audit(req, { action: 'admin.request_rejected', entity: 'EstablishmentRequest', entityId: request.id });
    return ok(res, { message: 'Solicitud rechazada.' });
  }),
);

/* ───────────────────────── Usuarios ───────────────────────── */

adminRouter.get(
  '/users',
  validate({
    query: paginationSchema.extend({
      role: z.enum(['cliente', 'supermercado', 'restaurante', 'superadmin']).optional(),
      status: z.enum(['activo', 'pendiente', 'suspendido']).optional(),
      search: z.string().trim().max(120).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; role?: string; status?: string; search?: string }>(req);
    const where = {
      deletedAt: null,
      ...(q.role ? { role: q.role as never } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { memberships: { include: { establishment: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.user.count({ where }),
    ]);
    return paginated(
      res,
      rows.map((u) => ({
        ...userDTO(u),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        establishments: u.memberships.map((m) => m.establishment),
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/**
 * Cambio de rol. Promover a superadministrador es un acto deliberado del
 * panel, auditado, y nunca alcanzable desde el registro público.
 */
adminRouter.patch(
  '/users/:id',
  validate({
    body: z.object({
      role: z.enum(['cliente', 'supermercado', 'restaurante', 'superadmin']).optional(),
      status: z.enum(['activo', 'pendiente', 'suspendido']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findFirst({ where: { id: param(req, 'id'), deletedAt: null } });
    if (!target) throw notFound('La persona no existe.');
    if (target.id === req.auth!.user.id && req.body.role && req.body.role !== 'superadmin') {
      throw badRequest('No puedes quitarte a ti mismo el rol de superadministrador.');
    }
    if (target.isDemo && req.body.role === 'superadmin') {
      throw badRequest('Una cuenta de demostración no puede ser superadministradora.');
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { ...(req.body.role ? { role: req.body.role } : {}), ...(req.body.status ? { status: req.body.status } : {}) },
      include: { memberships: { select: { establishmentId: true } } },
    });
    // Cambiar rol o suspender invalida las sesiones vigentes de esa persona.
    if (req.body.role || req.body.status) await revokeAllSessions(target.id);

    await audit(req, {
      action: 'admin.user_updated',
      entity: 'User',
      entityId: target.id,
      metadata: { from: { role: target.role, status: target.status }, to: req.body },
    });
    return ok(res, userDTO(updated));
  }),
);

/** Bitácora de auditoría. */
adminRouter.get(
  '/audit',
  validate({
    query: paginationSchema.extend({
      action: z.string().trim().max(80).optional(),
      entity: z.string().trim().max(60).optional(),
      userId: z.string().uuid().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; action?: string; entity?: string; userId?: string }>(req);
    const where = {
      ...(q.action ? { action: { contains: q.action } } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.userId ? { actorUserId: q.userId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.auditLog.count({ where }),
    ]);
    return paginated(
      res,
      rows.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        establishmentId: a.establishmentId,
        actor: a.actor,
        actorRole: a.actorRole,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/** Eventos de pasarela recientes: diagnóstico de pagos. */
adminRouter.get(
  '/payment-events',
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number }>(req);
    const [rows, total] = await Promise.all([
      prisma.paymentEvent.findMany({
        orderBy: { receivedAt: 'desc' },
        include: { payment: { select: { reference: true, orderId: true, amountInCents: true } } },
        ...skipTake(q),
      }),
      prisma.paymentEvent.count(),
    ]);
    return paginated(
      res,
      rows.map((e) => ({
        id: e.id,
        provider: e.provider as string,
        eventType: e.eventType,
        reportedStatus: e.reportedStatus,
        signatureValid: e.signatureValid,
        result: e.result,
        receivedAt: e.receivedAt.toISOString(),
        payment: e.payment,
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);
