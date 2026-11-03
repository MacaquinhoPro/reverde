import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, created, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { productDTO } from '../../domain/serialize.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';
import { resolveEstablishment } from '../../middleware/tenancy.ts';
import { setOnHand, syncIntelligence } from '../inventory/service.ts';

export const productsRouter = Router();

export const CATEGORIES = [
  'Lácteos',
  'Frutas y verduras',
  'Panadería',
  'Preparados',
  'Carnes',
  'Cajas de rescate',
  'Bebidas',
] as const;

const categorySchema = z.enum(CATEGORIES);
const unitSchema = z.enum(['unidad', 'kg', 'g', 'litro', 'bandeja', 'caja']);

const productBody = z.object({
  name: z.string().trim().min(3, 'El nombre necesita al menos 3 caracteres.').max(140),
  description: z.string().trim().max(600).default(''),
  category: categorySchema,
  emoji: z.string().trim().min(1).max(8).default('🥬'),
  image: z.string().trim().max(160).optional(),
  photo: z.string().trim().max(300).optional(),
  quantity: z.coerce.number().int().min(0).max(100_000),
  unit: unitSchema,
  weightPerUnitKg: z.coerce.number().min(0.001).max(500),
  entryDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  originalPrice: z.coerce.number().int().min(50, 'El precio mínimo es 50 COP.').max(50_000_000),
  discountPercent: z.coerce.number().int().min(0).max(80).default(0),
  dailySales: z.coerce.number().min(0).max(10_000).default(1),
  demandTrend: z.coerce.number().min(-1).max(1).default(0),
  featured: z.coerce.boolean().optional(),
  isRescueBox: z.coerce.boolean().optional(),
  status: z.enum(['en_inventario', 'publicado']).default('en_inventario'),
});

const listQuery = paginationSchema.extend({
  establishmentId: z.string().uuid().optional(),
  status: z.enum(['en_inventario', 'publicado', 'agotado', 'vencido', 'donado']).optional(),
  category: categorySchema.optional(),
  search: z.string().trim().max(120).optional(),
  risk: z.enum(['bajo', 'medio', 'alto']).optional(),
  sort: z.enum(['riesgo', 'vencimiento', 'nombre', 'precio', 'reciente']).default('riesgo'),
});

/** Inventario del establecimiento de la sesión. */
productsRouter.get(
  '/',
  requireAuth,
  requirePermission('products:read'),
  validate({ query: listQuery }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    const where = {
      establishmentId: req.establishmentId!,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };

    const orderBy =
      q.sort === 'vencimiento'
        ? { expiryDate: 'asc' as const }
        : q.sort === 'nombre'
          ? { name: 'asc' as const }
          : q.sort === 'precio'
            ? { originalPrice: 'asc' as const }
            : { createdAt: 'desc' as const };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { inventory: true },
        // El orden por riesgo se calcula en memoria: el score depende de la
        // fecha de hoy y no es una columna.
        ...(q.sort === 'riesgo' ? {} : { orderBy, ...skipTake(q) }),
      }),
      prisma.product.count({ where }),
    ]);

    let items = rows.map((p) => productDTO(p, { risk: true }));
    if (q.risk) items = items.filter((p) => p.risk?.level === q.risk);
    if (q.sort === 'riesgo') {
      items.sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0));
      const { skip, take } = skipTake(q);
      items = items.slice(skip, skip + take);
    }

    return paginated(res, items, { page: q.page, pageSize: q.pageSize, total: q.risk ? items.length : total });
  }),
);

productsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('products:read'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'id'), deletedAt: null },
      include: { inventory: true, recommendation: true, alert: true },
    });
    if (!product) throw notFound('El producto no existe.');
    // Aislamiento: nadie ve el inventario de otro establecimiento.
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }
    return ok(res, productDTO(product, { risk: true }));
  }),
);

productsRouter.post(
  '/',
  requireAuth,
  requirePermission('products:write'),
  validate({ body: productBody }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof productBody>;
    if (body.expiryDate <= body.entryDate) {
      throw badRequest('La fecha de vencimiento debe ser posterior a la de ingreso.');
    }

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          establishmentId: req.establishmentId!,
          name: body.name,
          description: body.description,
          category: body.category,
          emoji: body.emoji,
          image: body.image ?? 'from-[#EFF8EE] to-[#D3E9CE]',
          photo: body.photo ?? null,
          unit: body.unit,
          weightPerUnitKg: body.weightPerUnitKg,
          entryDate: body.entryDate,
          expiryDate: body.expiryDate,
          originalPrice: body.originalPrice,
          discountPercent: body.discountPercent,
          dailySales: body.dailySales,
          demandTrend: body.demandTrend,
          featured: body.featured ?? body.discountPercent >= 40,
          isRescueBox: body.isRescueBox ?? body.category === 'Cajas de rescate',
          status: body.status,
          origin: 'user',
          createdById: req.auth!.user.id,
          inventory: { create: { quantity: body.quantity } },
        },
        include: { inventory: true },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryId: createdProduct.inventory!.id,
          productId: createdProduct.id,
          establishmentId: req.establishmentId!,
          type: 'ingreso',
          quantity: body.quantity,
          reason: 'Registro inicial de producto',
          userId: req.auth!.user.id,
        },
      });

      if (body.status === 'publicado') {
        await tx.marketplaceListing.create({
          data: {
            productId: createdProduct.id,
            establishmentId: req.establishmentId!,
            featured: createdProduct.featured,
          },
        });
      }
      return createdProduct;
    });

    await syncIntelligence(req.establishmentId!);
    await audit(req, {
      action: 'product.created',
      entity: 'Product',
      entityId: product.id,
      establishmentId: req.establishmentId,
      metadata: { name: product.name, quantity: body.quantity },
    });
    return created(res, productDTO(product, { risk: true }));
  }),
);

productsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('products:write'),
  validate({ body: productBody.partial() }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: param(req, 'id'), deletedAt: null },
      include: { inventory: true },
    });
    if (!existing) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(existing.establishmentId)) {
      throw notFound('El producto no existe.');
    }

    const body = req.body as Partial<z.infer<typeof productBody>>;
    const entryDate = body.entryDate ?? existing.entryDate;
    const expiryDate = body.expiryDate ?? existing.expiryDate;
    if (expiryDate <= entryDate) throw badRequest('La fecha de vencimiento debe ser posterior a la de ingreso.');

    const { quantity, ...rest } = body;

    const updated = await prisma.$transaction(async (tx) => {
      if (quantity !== undefined) {
        await setOnHand(tx, existing.id, quantity, {
          establishmentId: existing.establishmentId,
          userId: req.auth!.user.id,
          reason: 'Ajuste manual desde inventario',
        });
      }

      const product = await tx.product.update({
        where: { id: existing.id },
        data: rest,
        include: { inventory: true },
      });

      // Publicar o despublicar mantiene la publicación del marketplace en línea.
      if (rest.status === 'publicado') {
        await tx.marketplaceListing.upsert({
          where: { productId: product.id },
          create: { productId: product.id, establishmentId: product.establishmentId, featured: product.featured },
          update: { status: 'activa', featured: product.featured, unpublishedAt: null, publishedAt: new Date() },
        });
      } else if (rest.status === 'en_inventario') {
        await tx.marketplaceListing.updateMany({
          where: { productId: product.id },
          data: { status: 'pausada', unpublishedAt: new Date() },
        });
      }
      return product;
    });

    await syncIntelligence(existing.establishmentId);
    await audit(req, {
      action: 'product.updated',
      entity: 'Product',
      entityId: existing.id,
      establishmentId: existing.establishmentId,
      metadata: { fields: Object.keys(body) },
    });
    return ok(res, productDTO(updated, { risk: true }));
  }),
);

/** Baja lógica: el histórico de ventas y movimientos debe seguir cuadrando. */
productsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: param(req, 'id'), deletedAt: null },
      include: { inventory: true },
    });
    if (!existing) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(existing.establishmentId)) {
      throw notFound('El producto no existe.');
    }
    if ((existing.inventory?.reservedQuantity ?? 0) > 0) {
      throw badRequest('No puedes eliminar un producto con unidades reservadas en pedidos pendientes.');
    }

    await prisma.$transaction([
      prisma.product.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'agotado' } }),
      prisma.marketplaceListing.updateMany({
        where: { productId: existing.id },
        data: { status: 'pausada', unpublishedAt: new Date() },
      }),
      prisma.cartItem.deleteMany({ where: { productId: existing.id } }),
      prisma.expirationAlert.deleteMany({ where: { productId: existing.id } }),
      prisma.recommendation.deleteMany({ where: { productId: existing.id } }),
    ]);

    await audit(req, {
      action: 'product.deleted',
      entity: 'Product',
      entityId: existing.id,
      establishmentId: existing.establishmentId,
      metadata: { name: existing.name },
    });
    return ok(res, { message: `${existing.name} se retiró del inventario.` });
  }),
);

/** Atajos que ya usaba la interfaz: descuento y publicación. */
productsRouter.post(
  '/:id/discount',
  requireAuth,
  requirePermission('products:write'),
  validate({ body: z.object({ percent: z.coerce.number().int().min(0).max(80) }) }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: param(req, 'id'), deletedAt: null } });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { discountPercent: req.body.percent },
      include: { inventory: true },
    });
    await syncIntelligence(product.establishmentId);
    await audit(req, {
      action: 'product.discount_applied',
      entity: 'Product',
      entityId: product.id,
      establishmentId: product.establishmentId,
      metadata: { percent: req.body.percent },
    });
    return ok(res, productDTO(updated, { risk: true }));
  }),
);

productsRouter.get('/meta/categories', (_req, res) => ok(res, { categories: CATEGORIES }));
