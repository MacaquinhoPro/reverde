import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { notFound } from '../../lib/errors.ts';
import { availableOf, productDTO, riskInputOf } from '../../domain/serialize.ts';
import { computeRisk, finalPrice } from '../../domain/risk.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';
import { resolveEstablishment } from '../../middleware/tenancy.ts';
import { setOnHand, syncIntelligence, writeOff } from './service.ts';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

/** Resumen de existencias y valor en riesgo del establecimiento. */
inventoryRouter.get(
  '/summary',
  requirePermission('products:read'),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { establishmentId: req.establishmentId!, deletedAt: null, status: { notIn: ['donado'] } },
      include: { inventory: true },
    });

    let high = 0;
    let medium = 0;
    let low = 0;
    let expiringSoon = 0;
    let valueAtRisk = 0;
    let inventoryValue = 0;
    let units = 0;

    for (const p of products) {
      const available = availableOf(p);
      const risk = computeRisk(riskInputOf(p, available));
      const value = finalPrice(p.originalPrice, p.discountPercent) * available;
      inventoryValue += value;
      units += available;
      if (risk.level === 'alto') {
        high += 1;
        valueAtRisk += value;
      } else if (risk.level === 'medio') {
        medium += 1;
        valueAtRisk += value * 0.4;
      } else {
        low += 1;
      }
      if (risk.daysLeft <= 3) expiringSoon += 1;
    }

    return ok(res, {
      total: products.length,
      units,
      high,
      medium,
      low,
      expiringSoon,
      published: products.filter((p) => p.status === 'publicado').length,
      inventoryValue,
      valueAtRisk: Math.round(valueAtRisk),
    });
  }),
);

/** Productos próximos a vencer, ordenados por urgencia. */
inventoryRouter.get(
  '/expiring',
  requirePermission('products:read'),
  validate({ query: paginationSchema.extend({ days: z.coerce.number().int().min(0).max(60).default(3), establishmentId: z.string().uuid().optional() }) }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; days: number }>(req);
    const limit = new Date();
    limit.setHours(23, 59, 59, 999);
    limit.setDate(limit.getDate() + q.days);

    const rows = await prisma.product.findMany({
      where: {
        establishmentId: req.establishmentId!,
        deletedAt: null,
        status: { in: ['en_inventario', 'publicado'] },
        expiryDate: { lte: limit },
      },
      include: { inventory: true },
      orderBy: { expiryDate: 'asc' },
      ...skipTake(q),
    });
    return ok(res, rows.map((p) => productDTO(p, { risk: true })));
  }),
);

/** Kardex: movimientos de existencias con filtros y paginación. */
inventoryRouter.get(
  '/movements',
  requirePermission('products:read'),
  validate({
    query: paginationSchema.extend({
      establishmentId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
      type: z.enum(['ingreso', 'ajuste', 'reserva', 'liberacion', 'venta', 'donacion', 'merma']).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; productId?: string; type?: string; from?: Date; to?: Date }>(req);
    const where = {
      establishmentId: req.establishmentId!,
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.type ? { type: q.type as never } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: { product: { select: { name: true, emoji: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      prisma.inventoryMovement.count({ where }),
    ]);
    return paginated(
      res,
      rows.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        emoji: m.product.emoji,
        unit: m.product.unit as string,
        type: m.type as string,
        quantity: m.quantity,
        reason: m.reason,
        orderId: m.orderId,
        createdAt: m.createdAt.toISOString(),
      })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/** Ajuste manual de existencias (conteo físico, merma detectada). */
inventoryRouter.post(
  '/:productId/adjust',
  requirePermission('inventory:write'),
  validate({ body: z.object({ quantity: z.coerce.number().int().min(0).max(100_000), reason: z.string().trim().max(200).optional() }) }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'productId'), deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }

    await prisma.$transaction((tx) =>
      setOnHand(tx, product.id, req.body.quantity, {
        establishmentId: product.establishmentId,
        userId: req.auth!.user.id,
        reason: req.body.reason ?? 'Ajuste de inventario',
      }),
    );
    await syncIntelligence(product.establishmentId);
    await audit(req, {
      action: 'inventory.adjusted',
      entity: 'Product',
      entityId: product.id,
      establishmentId: product.establishmentId,
      metadata: { from: product.inventory?.quantity ?? 0, to: req.body.quantity },
    });

    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true },
    });
    return ok(res, productDTO(refreshed, { risk: true }));
  }),
);

/** Baja por merma: el producto se perdió. Queda en el kardex. */
inventoryRouter.post(
  '/:productId/write-off',
  requirePermission('inventory:write'),
  validate({ body: z.object({ quantity: z.coerce.number().int().min(1), reason: z.string().trim().min(3).max(200) }) }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: param(req, 'productId'), deletedAt: null } });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }
    await prisma.$transaction((tx) =>
      writeOff(tx, product.id, req.body.quantity, 'merma', {
        establishmentId: product.establishmentId,
        userId: req.auth!.user.id,
        reason: req.body.reason,
      }),
    );
    await syncIntelligence(product.establishmentId);
    await audit(req, {
      action: 'inventory.write_off',
      entity: 'Product',
      entityId: product.id,
      establishmentId: product.establishmentId,
      metadata: { quantity: req.body.quantity },
    });
    return ok(res, { message: 'Merma registrada.' });
  }),
);
