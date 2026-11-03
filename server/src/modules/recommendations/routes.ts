import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, paginated, paginationSchema, param, query, skipTake, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { availableOf, productDTO, recommendationDTO, riskInputOf } from '../../domain/serialize.ts';
import { computeRisk, finalPrice, qtyLabel } from '../../domain/risk.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';
import { resolveEstablishment } from '../../middleware/tenancy.ts';
import { syncIntelligence, writeOff } from '../inventory/service.ts';

export const recommendationsRouter = Router();

recommendationsRouter.use(requireAuth);

const listQuery = paginationSchema.extend({
  establishmentId: z.string().uuid().optional(),
  minScore: z.coerce.number().int().min(0).max(100).default(0),
  applied: z.coerce.boolean().optional(),
});

/** Recomendaciones ordenadas por riesgo de desperdicio. */
recommendationsRouter.get(
  '/',
  requirePermission('recommendations:read'),
  validate({ query: listQuery }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<z.infer<typeof listQuery>>(req);
    await syncIntelligence(req.establishmentId!);

    const where = {
      establishmentId: req.establishmentId!,
      riskScore: { gte: q.minScore },
      product: { deletedAt: null },
      ...(q.applied === undefined ? {} : q.applied ? { appliedAt: { not: null } } : { appliedAt: null }),
    };
    const [rows, total] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        include: { product: { include: { inventory: true } } },
        orderBy: { riskScore: 'desc' },
        ...skipTake(q),
      }),
      prisma.recommendation.count({ where }),
    ]);

    return paginated(
      res,
      rows.map((r) => ({ ...recommendationDTO(r), product: productDTO(r.product, { risk: true }) })),
      { page: q.page, pageSize: q.pageSize, total },
    );
  }),
);

/** Detalle con explicabilidad: los factores que componen el Risk Score. */
recommendationsRouter.get(
  '/:productId',
  requirePermission('recommendations:read'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'productId'), deletedAt: null },
      include: { inventory: true, recommendation: true },
    });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }
    await syncIntelligence(product.establishmentId);
    const recommendation = await prisma.recommendation.findUnique({ where: { productId: product.id } });
    const risk = computeRisk(riskInputOf(product));

    const history = await prisma.promoOutcome.findMany({
      where: { category: product.category, OR: [{ establishmentId: product.establishmentId }, { isSeed: true }] },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    });

    return ok(res, {
      product: productDTO(product, { risk: true }),
      risk,
      recommendation: recommendation ? recommendationDTO(recommendation) : null,
      history: history.map((h) => ({
        discountPercent: h.discountPercent,
        sellThrough: h.sellThrough,
        daysToSell: h.daysToSell,
        date: h.occurredAt.toISOString(),
      })),
    });
  }),
);

const applySchema = z.object({
  action: z.enum(['descuento', 'combo', 'publicar', 'caja_rescate', 'destacar', 'donar', 'venta_presencial']),
  discount: z.coerce.number().int().min(0).max(80).optional(),
});

/**
 * Ejecuta la acción recomendada. Es la misma lógica que antes vivía en
 * `applyRecommendation` del contexto del frontend, ahora transaccional y
 * sobre datos persistidos.
 */
recommendationsRouter.post(
  '/:productId/apply',
  requirePermission('recommendations:apply'),
  validate({ body: applySchema }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'productId'), deletedAt: null },
      include: { inventory: true, recommendation: true },
    });
    if (!product) throw notFound('El producto no existe.');
    if (req.auth!.user.role !== 'superadmin' && !req.auth!.user.establishmentIds.includes(product.establishmentId)) {
      throw notFound('El producto no existe.');
    }

    const { action } = req.body as z.infer<typeof applySchema>;
    const discount = req.body.discount ?? product.recommendation?.suggestedDiscount ?? 20;
    const available = availableOf(product);
    const establishmentId = product.establishmentId;
    const userId = req.auth!.user.id;

    const message = await prisma.$transaction(async (tx) => {
      const publish = async (featured = false) => {
        await tx.product.update({
          where: { id: product.id },
          data: { status: 'publicado', ...(featured ? { featured: true } : {}) },
        });
        await tx.marketplaceListing.upsert({
          where: { productId: product.id },
          create: { productId: product.id, establishmentId, featured },
          update: { status: 'activa', featured, unpublishedAt: null, publishedAt: new Date() },
        });
      };

      switch (action) {
        case 'descuento':
          await tx.product.update({ where: { id: product.id }, data: { discountPercent: discount } });
          return `Descuento del ${discount} % aplicado a ${product.name}.`;

        case 'publicar':
          await publish();
          return `${product.name} ya está visible en el marketplace.`;

        case 'combo': {
          const comboDiscount = Math.max(discount - 5, 15);
          await tx.product.update({
            where: { id: product.id },
            data: { discountPercent: comboDiscount, featured: true },
          });
          await publish(true);
          return `Combo creado: ${product.name} destacado con ${comboDiscount} % de descuento.`;
        }

        case 'destacar':
          await publish(true);
          return `${product.name} destacado en el marketplace.`;

        case 'caja_rescate': {
          // La caja toma unidades del producto original: el stock debe cuadrar.
          const boxQty = Math.max(1, Math.floor(available / 3));
          const consumed = boxQty * 3;
          if (consumed > available) throw badRequest('No hay suficiente stock libre para armar la caja.');

          const box = await tx.product.create({
            data: {
              establishmentId,
              name: `Caja de rescate · ${product.name}`,
              description: `Caja sorpresa con ${qtyLabel(consumed, product.unit as string)} de ${product.name.toLowerCase()} en excelente estado, rescatados antes de su vencimiento.`,
              category: 'Cajas de rescate',
              emoji: '🧺',
              image: 'from-[#F0F8EC] to-[#D6E9C6]',
              photo: product.photo ?? '/img/productos/cajaFrutas.jpg',
              unit: 'caja',
              weightPerUnitKg: product.weightPerUnitKg * 3,
              entryDate: new Date(),
              expiryDate: product.expiryDate,
              originalPrice: Math.round((product.originalPrice * 3) / 100) * 100,
              discountPercent: Math.max(discount, 40),
              dailySales: product.dailySales,
              demandTrend: product.demandTrend,
              status: 'publicado',
              isRescueBox: true,
              featured: true,
              origin: 'user',
              createdById: userId,
              inventory: { create: { quantity: boxQty } },
            },
            include: { inventory: true },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: box.inventory!.id,
              productId: box.id,
              establishmentId,
              type: 'ingreso',
              quantity: boxQty,
              reason: `Caja de rescate creada desde ${product.name}`,
              userId,
            },
          });
          await tx.marketplaceListing.create({
            data: { productId: box.id, establishmentId, featured: true },
          });
          await writeOff(tx, product.id, consumed, 'merma', {
            establishmentId,
            userId,
            reason: `Trasladado a caja de rescate ${box.id}`,
          });
          return `Caja de rescate creada con ${boxQty} ${boxQty === 1 ? 'unidad' : 'unidades'} publicadas.`;
        }

        case 'donar': {
          if (available <= 0) throw badRequest('No hay stock libre para donar.');
          const weight = +(available * product.weightPerUnitKg).toFixed(2);
          await writeOff(tx, product.id, available, 'donacion', {
            establishmentId,
            userId,
            reason: 'Donación a banco de alimentos',
          });
          await tx.product.update({ where: { id: product.id }, data: { status: 'donado' } });
          await tx.marketplaceListing.updateMany({
            where: { productId: product.id },
            data: { status: 'pausada', unpublishedAt: new Date() },
          });
          // La donación entra al libro de ventas con valor recuperado 0: evita
          // desperdicio pero no genera ingreso.
          await tx.sale.create({
            data: {
              establishmentId,
              productId: product.id,
              productName: product.name,
              emoji: product.emoji,
              photo: product.photo,
              category: product.category,
              customerName: 'Banco de Alimentos',
              quantity: available,
              originalPrice: product.originalPrice,
              soldPrice: 0,
              discountPercent: 100,
              recovered: 0,
              wasteAvoidedKg: weight,
              channel: 'tienda',
            },
          });
          return `${product.name} donado: ${weight} kg evitaron convertirse en desperdicio.`;
        }

        case 'venta_presencial':
          await tx.product.update({ where: { id: product.id }, data: { featured: true } });
          return `${product.name} marcado como prioridad de venta presencial.`;

        default:
          return 'Acción aplicada.';
      }
    });

    await prisma.recommendation.updateMany({
      where: { productId: product.id },
      data: { appliedAction: action, appliedAt: new Date(), appliedById: userId },
    });
    await syncIntelligence(establishmentId);
    await audit(req, {
      action: 'recommendation.applied',
      entity: 'Product',
      entityId: product.id,
      establishmentId,
      metadata: { recommendedAction: action, discount },
    });

    const refreshed = await prisma.product.findUnique({
      where: { id: product.id },
      include: { inventory: true },
    });
    return ok(res, {
      message,
      product: refreshed ? productDTO(refreshed, { risk: true }) : null,
      price: refreshed ? finalPrice(refreshed.originalPrice, refreshed.discountPercent) : null,
    });
  }),
);
