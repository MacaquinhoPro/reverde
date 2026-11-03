import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, paginated, paginationSchema, param, query, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { notFound } from '../../lib/errors.ts';
import { availableOf, establishmentDTO, productDTO, riskInputOf } from '../../domain/serialize.ts';
import { computeRisk, finalPrice } from '../../domain/risk.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';
import { CATEGORIES } from '../products/routes.ts';

export const marketplaceRouter = Router();

const browseQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  category: z.union([z.enum(CATEGORIES), z.literal('todas')]).optional(),
  establishmentId: z.string().uuid().optional(),
  establishmentType: z.enum(['todos', 'supermercado', 'restaurante']).optional(),
  maxDistance: z.coerce.number().min(0).max(500).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minDiscount: z.coerce.number().int().min(0).max(80).optional(),
  expiringSoon: z.coerce.boolean().optional(),
  city: z.string().trim().max(80).optional(),
  sort: z.enum(['relevancia', 'descuento', 'precio', 'distancia', 'vencimiento']).default('relevancia'),
});

/**
 * Catálogo público: solo publicaciones activas, de establecimientos activos y
 * con stock disponible. No exige sesión (el marketplace se puede explorar
 * antes de registrarse), pero el precio y el stock siempre salen del backend.
 */
marketplaceRouter.get(
  '/',
  validate({ query: browseQuery }),
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof browseQuery>>(req);

    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 'publicado',
        listing: { status: 'activa' },
        establishment: {
          status: 'activo',
          ...(q.establishmentType && q.establishmentType !== 'todos' ? { type: q.establishmentType } : {}),
          ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
          ...(q.maxDistance !== undefined ? { distanceKm: { lte: q.maxDistance } } : {}),
        },
        ...(q.establishmentId ? { establishmentId: q.establishmentId } : {}),
        ...(q.category && q.category !== 'todas' ? { category: q.category } : {}),
        ...(q.minDiscount ? { discountPercent: { gte: q.minDiscount } } : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' as const } },
                { category: { contains: q.search, mode: 'insensitive' as const } },
                { establishment: { name: { contains: q.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { inventory: true, establishment: true, listing: true },
    });

    // Lo que depende de la fecha de hoy o del stock reservado se filtra en
    // memoria: no son columnas que se puedan indexar.
    let items = rows
      .filter((p) => availableOf(p) > 0)
      .map((p) => ({
        dto: productDTO(p, { risk: true }),
        establishment: p.establishment,
        featured: p.listing?.featured ?? p.featured,
      }));

    if (q.maxPrice !== undefined) items = items.filter((i) => i.dto.price <= q.maxPrice!);
    if (q.expiringSoon) items = items.filter((i) => (i.dto.risk?.daysLeft ?? 99) <= 2);

    items.sort((a, b) => {
      switch (q.sort) {
        case 'descuento':
          return b.dto.discountPercent - a.dto.discountPercent;
        case 'precio':
          return a.dto.price - b.dto.price;
        case 'distancia':
          return a.establishment.distanceKm - b.establishment.distanceKm;
        case 'vencimiento':
          return (a.dto.risk?.daysLeft ?? 99) - (b.dto.risk?.daysLeft ?? 99);
        default:
          // Relevancia: destacados primero, luego mayor urgencia.
          return Number(b.featured) - Number(a.featured) || (b.dto.risk?.score ?? 0) - (a.dto.risk?.score ?? 0);
      }
    });

    const total = items.length;
    const start = (q.page - 1) * q.pageSize;
    const page = items.slice(start, start + q.pageSize);

    return paginated(
      res,
      page.map((i) => ({ ...i.dto, featured: i.featured, establishment: establishmentDTO(i.establishment) })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/** Ficha pública de un producto publicado. */
marketplaceRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'id'), deletedAt: null },
      include: { inventory: true, establishment: true, listing: true },
    });
    if (!product || product.establishment.status !== 'activo') throw notFound('El producto no está disponible.');
    // Un producto despublicado no se expone por URL directa.
    if (product.status !== 'publicado' || product.listing?.status !== 'activa') {
      throw notFound('El producto no está disponible.');
    }
    return ok(res, {
      ...productDTO(product, { risk: true }),
      featured: product.listing?.featured ?? product.featured,
      establishment: establishmentDTO(product.establishment),
      similar: await similarProducts(product.id, product.category, product.establishmentId),
    });
  }),
);

async function similarProducts(excludeId: string, category: string, establishmentId: string) {
  const rows = await prisma.product.findMany({
    where: {
      id: { not: excludeId },
      deletedAt: null,
      status: 'publicado',
      listing: { status: 'activa' },
      establishment: { status: 'activo' },
      OR: [{ category }, { establishmentId }],
    },
    include: { inventory: true, establishment: true },
    take: 12,
  });
  return rows
    .filter((p) => availableOf(p) > 0)
    .slice(0, 6)
    .map((p) => ({ ...productDTO(p), establishment: establishmentDTO(p.establishment) }));
}

/** Resumen del catálogo: lo usan los filtros y el mapa. */
marketplaceRouter.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 'publicado',
        listing: { status: 'activa' },
        establishment: { status: 'activo' },
      },
      include: { inventory: true, establishment: { select: { id: true, name: true, type: true, distanceKm: true } } },
    });
    const live = rows.filter((p) => availableOf(p) > 0);

    const byCategory = new Map<string, number>();
    const byEstablishment = new Map<string, { id: string; name: string; type: string; count: number }>();
    let maxPrice = 0;

    for (const p of live) {
      byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
      const e = byEstablishment.get(p.establishmentId) ?? {
        id: p.establishment.id,
        name: p.establishment.name,
        type: p.establishment.type as string,
        count: 0,
      };
      e.count += 1;
      byEstablishment.set(p.establishmentId, e);
      maxPrice = Math.max(maxPrice, finalPrice(p.originalPrice, p.discountPercent));
    }

    return ok(res, {
      total: live.length,
      categories: [...byCategory.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      establishments: [...byEstablishment.values()].sort((a, b) => b.count - a.count),
      maxPrice,
      expiringToday: live.filter((p) => computeRisk(riskInputOf(p)).daysLeft <= 1).length,
    });
  }),
);

/* ─────────── Publicaciones vistas desde el establecimiento ─────────── */

marketplaceRouter.post(
  '/listings/:productId/publish',
  requireAuth,
  requirePermission('marketplace:publish'),
  validate({ body: z.object({ featured: z.coerce.boolean().default(false) }) }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'productId'), deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { status: 'publicado', featured: req.body.featured || product.featured },
      }),
      prisma.marketplaceListing.upsert({
        where: { productId: product.id },
        create: { productId: product.id, establishmentId: product.establishmentId, featured: req.body.featured },
        update: { status: 'activa', featured: req.body.featured, unpublishedAt: null, publishedAt: new Date() },
      }),
    ]);
    await audit(req, {
      action: 'marketplace.published',
      entity: 'Product',
      entityId: product.id,
      establishmentId: product.establishmentId,
    });
    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true },
    });
    return ok(res, productDTO(refreshed, { risk: true }));
  }),
);

marketplaceRouter.post(
  '/listings/:productId/unpublish',
  requireAuth,
  requirePermission('marketplace:publish'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: param(req, 'productId'), deletedAt: null } });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }
    await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { status: 'en_inventario' } }),
      prisma.marketplaceListing.updateMany({
        where: { productId: product.id },
        data: { status: 'pausada', unpublishedAt: new Date() },
      }),
      // Un producto despublicado no puede quedar en carritos ajenos.
      prisma.cartItem.deleteMany({ where: { productId: product.id } }),
    ]);
    await audit(req, {
      action: 'marketplace.unpublished',
      entity: 'Product',
      entityId: product.id,
      establishmentId: product.establishmentId,
    });
    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { inventory: true },
    });
    return ok(res, productDTO(refreshed, { risk: true }));
  }),
);
