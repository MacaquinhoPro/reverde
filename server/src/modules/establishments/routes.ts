import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, created, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { encrypt } from '../../lib/crypto.ts';
import { conflict, forbidden, notFound } from '../../lib/errors.ts';
import { establishmentDTO } from '../../domain/serialize.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission, requireRole } from '../../middleware/rbac.ts';

export const establishmentsRouter = Router();

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);

const upsertSchema = z.object({
  name: z.string().trim().min(2).max(140),
  type: z.enum(['supermercado', 'restaurante']),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  schedule: z.string().trim().min(3).max(120),
  logoHue: z.coerce.number().int().min(0).max(360).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  mapX: z.coerce.number().min(0).max(100).optional(),
  mapY: z.coerce.number().min(0).max(100).optional(),
  distanceKm: z.coerce.number().min(0).max(500).optional(),
  status: z.enum(['activo', 'pendiente', 'suspendido']).optional(),
});

const listQuery = paginationSchema.extend({
  type: z.enum(['supermercado', 'restaurante']).optional(),
  status: z.enum(['activo', 'pendiente', 'suspendido']).optional(),
  city: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
});

/**
 * Directorio público: solo establecimientos activos. Lo consume el mapa y el
 * marketplace, así que no exige sesión.
 */
establishmentsRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    const isAdmin = req.auth?.user.role === 'superadmin';
    const where = {
      ...(isAdmin ? (q.status ? { status: q.status } : {}) : { status: 'activo' as const }),
      ...(q.type ? { type: q.type } : {}),
      ...(q.city ? { city: { contains: q.city, mode: 'insensitive' as const } } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.establishment.findMany({ where, orderBy: { name: 'asc' }, ...skipTake(q) }),
      prisma.establishment.count({ where }),
    ]);
    return paginated(res, rows.map(establishmentDTO), { page: q.page, pageSize: q.pageSize, total });
  }),
);

establishmentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const est = await prisma.establishment.findUnique({
      where: { id: param(req, 'id') },
      include: { _count: { select: { products: true, listings: true } } },
    });
    if (!est) throw notFound('El establecimiento no existe.');
    if (est.status !== 'activo' && req.auth?.user.role !== 'superadmin' && !req.auth?.user.establishmentIds.includes(est.id)) {
      throw notFound('El establecimiento no existe.');
    }
    return ok(res, { ...establishmentDTO(est), productCount: est._count.products, listingCount: est._count.listings });
  }),
);

/* ───────────── Solicitudes de cuenta de establecimiento ───────────── */

const requestSchema = z.object({
  name: z.string().trim().min(2).max(140),
  type: z.enum(['supermercado', 'restaurante']),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  schedule: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(24).optional(),
});

establishmentsRouter.post(
  '/requests',
  requireAuth,
  requirePermission('establishments:request'),
  validate({ body: requestSchema }),
  asyncHandler(async (req, res) => {
    const pending = await prisma.establishmentRequest.findFirst({
      where: { userId: req.auth!.user.id, status: 'pendiente' },
    });
    if (pending) throw conflict('Ya tienes una solicitud pendiente de revisión.');

    const request = await prisma.establishmentRequest.create({
      data: {
        userId: req.auth!.user.id,
        establishmentName: req.body.name,
        type: req.body.type,
        address: req.body.address,
        city: req.body.city,
        schedule: req.body.schedule ?? 'Lun a Dom · 8:00 – 20:00',
        contactPhoneEnc: req.body.phone ? encrypt(req.body.phone) : null,
      },
    });
    await prisma.notification.create({
      data: {
        type: 'establishment_request',
        title: 'Nueva solicitud de establecimiento',
        body: `${request.establishmentName} (${request.city}) espera aprobación.`,
        data: { requestId: request.id },
      },
    });
    await audit(req, { action: 'establishment.request_created', entity: 'EstablishmentRequest', entityId: request.id });
    return created(res, { id: request.id, status: request.status, createdAt: request.createdAt.toISOString() });
  }),
);

establishmentsRouter.get(
  '/requests/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await prisma.establishmentRequest.findMany({
      where: { userId: req.auth!.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return ok(
      res,
      rows.map((r) => ({
        id: r.id,
        name: r.establishmentName,
        type: r.type as string,
        city: r.city,
        status: r.status as string,
        notes: r.notes,
        establishmentId: r.establishmentId,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }),
);

/* ─────────────────── Administración (superadmin) ─────────────────── */

establishmentsRouter.post(
  '/',
  requireAuth,
  requireRole('superadmin'),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const est = await prisma.establishment.create({
      data: { ...req.body, slug: `${slugify(req.body.name)}-${Date.now().toString(36).slice(-4)}` },
    });
    await audit(req, { action: 'establishment.created', entity: 'Establishment', entityId: est.id, establishmentId: est.id });
    return created(res, establishmentDTO(est));
  }),
);

establishmentsRouter.patch(
  '/:id',
  requireAuth,
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const isAdmin = req.auth!.user.role === 'superadmin';
    if (!isAdmin && !req.auth!.user.establishmentIds.includes(id)) {
      throw forbidden('Solo puedes editar tu propio establecimiento.');
    }
    // Cambiar el estado (activar/suspender) es exclusivo del superadmin.
    if (!isAdmin && req.body.status !== undefined) {
      throw forbidden('El estado del establecimiento lo cambia la administración de la plataforma.');
    }
    const est = await prisma.establishment.update({ where: { id }, data: req.body });
    await audit(req, {
      action: 'establishment.updated',
      entity: 'Establishment',
      entityId: id,
      establishmentId: id,
      metadata: { fields: Object.keys(req.body) },
    });
    return ok(res, establishmentDTO(est));
  }),
);

/* ───────────────── Administradores del establecimiento ───────────────── */

establishmentsRouter.get(
  '/:id/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(id)) {
      throw forbidden('No tienes acceso a los administradores de ese establecimiento.');
    }
    const members = await prisma.establishmentUser.findMany({
      where: { establishmentId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return ok(
      res,
      members.map((m) => ({
        ...m.user,
        membershipId: m.id,
        // `role` del usuario es su rol global; `membershipRole` su papel aquí.
        membershipRole: m.role as string,
      })),
    );
  }),
);

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['owner', 'manager', 'staff']).default('staff'),
});

establishmentsRouter.post(
  '/:id/members',
  requireAuth,
  validate({ body: memberSchema }),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const isAdmin = req.auth!.user.role === 'superadmin';
    if (!isAdmin) {
      const own = await prisma.establishmentUser.findFirst({
        where: { establishmentId: id, userId: req.auth!.user.id, role: 'owner' },
      });
      if (!own) throw forbidden('Solo el propietario del establecimiento puede agregar administradores.');
    }

    const est = await prisma.establishment.findUnique({ where: { id } });
    if (!est) throw notFound('El establecimiento no existe.');

    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) throw notFound('No existe una cuenta con ese correo. Pídele que se registre primero.');

    const membership = await prisma.$transaction(async (tx) => {
      const m = await tx.establishmentUser.upsert({
        where: { establishmentId_userId: { establishmentId: id, userId: user.id } },
        update: { role: req.body.role },
        create: { establishmentId: id, userId: user.id, role: req.body.role },
      });
      // Al asociarlo, su rol pasa al tipo del establecimiento (nunca a superadmin).
      if (user.role === 'cliente') {
        await tx.user.update({ where: { id: user.id }, data: { role: est.type } });
      }
      return m;
    });

    await audit(req, {
      action: 'establishment.member_added',
      entity: 'EstablishmentUser',
      entityId: membership.id,
      establishmentId: id,
      metadata: { userId: user.id, role: req.body.role },
    });
    return created(res, { membershipId: membership.id, userId: user.id, role: membership.role as string });
  }),
);

establishmentsRouter.delete(
  '/:id/members/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const userId = param(req, 'userId');
    const isAdmin = req.auth!.user.role === 'superadmin';
    if (!isAdmin) {
      const own = await prisma.establishmentUser.findFirst({
        where: { establishmentId: id, userId: req.auth!.user.id, role: 'owner' },
      });
      if (!own) throw forbidden('Solo el propietario puede quitar administradores.');
    }
    const result = await prisma.establishmentUser.deleteMany({ where: { establishmentId: id, userId } });
    if (result.count === 0) throw notFound('Esa persona no administra este establecimiento.');
    await audit(req, {
      action: 'establishment.member_removed',
      entity: 'EstablishmentUser',
      establishmentId: id,
      metadata: { userId },
    });
    return ok(res, { message: 'Administrador retirado.' });
  }),
);
