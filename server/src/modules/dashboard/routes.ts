/**
 * Métricas. Todo sale del libro de ventas (tabla Sale) y del inventario
 * persistido: no hay un solo número fijo en el código.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, paginationSchema, query, skipTake, validate } from '../../lib/http.ts';
import { availableOf, productDTO, riskInputOf, saleDTO } from '../../domain/serialize.ts';
import { co2FromKg, computeRisk, finalPrice, waterFromKg } from '../../domain/risk.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';
import { resolveEstablishment } from '../../middleware/tenancy.ts';
import { syncIntelligence } from '../inventory/service.ts';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

interface Impact {
  rescued: number;
  wasteAvoidedKg: number;
  recovered: number;
  lossesAvoided: number;
  recoveryRate: number;
  marketplaceSales: number;
  orders: number;
}

type SaleRow = { quantity: number; wasteAvoidedKg: number; recovered: number; originalPrice: number; channel: string };

function aggregate(sales: SaleRow[]): Impact {
  const rescued = sales.reduce((s, v) => s + v.quantity, 0);
  const wasteAvoidedKg = +sales.reduce((s, v) => s + v.wasteAvoidedKg, 0).toFixed(2);
  const recovered = sales.reduce((s, v) => s + v.recovered, 0);
  const lossesAvoided = sales.reduce((s, v) => s + v.originalPrice * v.quantity, 0);
  return {
    rescued,
    wasteAvoidedKg,
    recovered,
    lossesAvoided,
    recoveryRate: lossesAvoided ? (recovered / lossesAvoided) * 100 : 0,
    marketplaceSales: sales.filter((s) => s.channel === 'marketplace').length,
    orders: sales.length,
  };
}

const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

const scopeQuery = z.object({
  establishmentId: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** Resumen del establecimiento: KPIs, comparativa mensual y series. */
dashboardRouter.get(
  '/overview',
  requirePermission('dashboard:read'),
  validate({ query: scopeQuery }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const { days } = query<z.infer<typeof scopeQuery>>(req);
    const establishmentId = req.establishmentId!;
    await syncIntelligence(establishmentId);

    const now = Date.now();
    const since = new Date(now - days * 86_400_000);
    const prevSince = new Date(now - days * 2 * 86_400_000);

    const [sales, products, alerts, pendingOrders] = await Promise.all([
      prisma.sale.findMany({
        where: { establishmentId, occurredAt: { gte: prevSince } },
        select: {
          quantity: true,
          wasteAvoidedKg: true,
          recovered: true,
          originalPrice: true,
          channel: true,
          occurredAt: true,
          category: true,
        },
      }),
      prisma.product.findMany({
        where: { establishmentId, deletedAt: null, status: { notIn: ['donado'] } },
        include: { inventory: true },
      }),
      prisma.expirationAlert.groupBy({
        by: ['level'],
        where: { establishmentId, status: 'abierta' },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: { items: { some: { establishmentId } }, status: { in: ['PENDING_PAYMENT', 'PAID'] }, fulfillmentStatus: { not: 'entregado' } },
      }),
    ]);

    const current = aggregate(sales.filter((s) => s.occurredAt >= since));
    const previous = aggregate(sales.filter((s) => s.occurredAt < since));

    // Inventario y valor en riesgo, con el Risk Score de hoy.
    let valueAtRisk = 0;
    let inventoryValue = 0;
    const byCategory = new Map<string, { category: string; score: number; items: number; kg: number }>();
    const riskCounts = { alto: 0, medio: 0, bajo: 0 };

    for (const p of products) {
      const available = availableOf(p);
      const risk = computeRisk(riskInputOf(p, available));
      const value = finalPrice(p.originalPrice, p.discountPercent) * available;
      inventoryValue += value;
      riskCounts[risk.level] += 1;
      if (risk.level === 'alto') valueAtRisk += value;
      else if (risk.level === 'medio') valueAtRisk += value * 0.4;

      const entry = byCategory.get(p.category) ?? { category: p.category, score: 0, items: 0, kg: 0 };
      entry.score += risk.score;
      entry.items += 1;
      if (risk.level !== 'bajo') entry.kg += available * p.weightPerUnitKg;
      byCategory.set(p.category, entry);
    }

    // Serie semanal de las últimas 8 semanas, igual que la gráfica actual.
    const weeks = 8;
    const buckets = Array.from({ length: weeks }, (_, i) => ({
      label: i === weeks - 1 ? 'Esta sem.' : `S${i + 1}`,
      weeksAgo: weeks - 1 - i,
      wasteAvoidedKg: 0,
      recovered: 0,
      rescued: 0,
      marketplace: 0,
    }));
    for (const s of sales) {
      const weeksAgo = Math.floor((now - s.occurredAt.getTime()) / (7 * 86_400_000));
      const bucket = buckets.find((b) => b.weeksAgo === weeksAgo);
      if (!bucket) continue;
      bucket.wasteAvoidedKg += s.wasteAvoidedKg;
      bucket.recovered += s.recovered;
      bucket.rescued += s.quantity;
      if (s.channel === 'marketplace') bucket.marketplace += s.quantity;
    }

    return ok(res, {
      period: { days, from: since.toISOString(), to: new Date(now).toISOString() },
      current,
      previous,
      deltas: {
        rescued: delta(current.rescued, previous.rescued),
        wasteAvoidedKg: delta(current.wasteAvoidedKg, previous.wasteAvoidedKg),
        recovered: delta(current.recovered, previous.recovered),
        lossesAvoided: delta(current.lossesAvoided, previous.lossesAvoided),
        extraRecovered: current.recovered - previous.recovered,
      },
      environmental: {
        co2AvoidedKg: co2FromKg(current.wasteAvoidedKg),
        waterSavedL: waterFromKg(current.wasteAvoidedKg),
      },
      inventory: {
        total: products.length,
        units: products.reduce((s, p) => s + availableOf(p), 0),
        published: products.filter((p) => p.status === 'publicado').length,
        inventoryValue,
        valueAtRisk: Math.round(valueAtRisk),
        ...riskCounts,
      },
      alerts: {
        alto: alerts.find((a) => a.level === 'alto')?._count._all ?? 0,
        medio: alerts.find((a) => a.level === 'medio')?._count._all ?? 0,
        total: alerts.reduce((s, a) => s + a._count._all, 0),
      },
      pendingOrders,
      riskByCategory: [...byCategory.values()]
        .map((e) => ({ ...e, score: Math.round(e.score / e.items), kg: +e.kg.toFixed(1) }))
        .sort((a, b) => b.score - a.score),
      weekly: buckets.map((b) => ({ ...b, wasteAvoidedKg: +b.wasteAvoidedKg.toFixed(1) })),
    });
  }),
);

/** Priorización: los productos con mayor riesgo del establecimiento. */
dashboardRouter.get(
  '/priority',
  requirePermission('dashboard:read'),
  validate({ query: scopeQuery.extend({ limit: z.coerce.number().int().min(1).max(50).default(8) }) }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const { limit } = query<{ limit: number }>(req);
    await syncIntelligence(req.establishmentId!);
    const products = await prisma.product.findMany({
      where: { establishmentId: req.establishmentId!, deletedAt: null, status: { in: ['en_inventario', 'publicado'] } },
      include: { inventory: true, recommendation: true },
    });
    const scored = products
      .map((p) => ({
        product: productDTO(p, { risk: true }),
        recommendation: p.recommendation
          ? {
              title: p.recommendation.title,
              suggestedDiscount: p.recommendation.suggestedDiscount,
              confidence: p.recommendation.confidence,
              actions: p.recommendation.actions,
            }
          : null,
      }))
      .filter((x) => x.product.quantity > 0)
      .sort((a, b) => (b.product.risk?.score ?? 0) - (a.product.risk?.score ?? 0))
      .slice(0, limit);
    return ok(res, scored);
  }),
);

/** Historial de ventas del establecimiento. */
dashboardRouter.get(
  '/sales',
  requirePermission('dashboard:read'),
  validate({
    query: paginationSchema.extend({
      establishmentId: z.string().uuid().optional(),
      days: z.coerce.number().int().min(1).max(365).optional(),
      channel: z.enum(['marketplace', 'tienda']).optional(),
      category: z.string().trim().max(60).optional(),
    }),
  }),
  resolveEstablishment,
  asyncHandler(async (req, res) => {
    const q = query<{ page: number; pageSize: number; days?: number; channel?: string; category?: string }>(req);
    const where = {
      establishmentId: req.establishmentId!,
      ...(q.days ? { occurredAt: { gte: new Date(Date.now() - q.days * 86_400_000) } } : {}),
      ...(q.channel ? { channel: q.channel as never } : {}),
      ...(q.category ? { category: q.category } : {}),
    };
    const [rows, total, totals] = await Promise.all([
      prisma.sale.findMany({ where, orderBy: { occurredAt: 'desc' }, ...skipTake(q) }),
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where,
        _sum: { recovered: true, wasteAvoidedKg: true, quantity: true },
      }),
    ]);
    // Se responde a mano para añadir los acumulados al bloque `meta`.
    return res.json({
      data: rows.map(saleDTO),
      meta: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
        totals: {
          recovered: totals._sum.recovered ?? 0,
          wasteAvoidedKg: +(totals._sum.wasteAvoidedKg ?? 0).toFixed(2),
          rescued: totals._sum.quantity ?? 0,
        },
      },
    });
  }),
);

/** Métricas de la persona compradora: su ahorro y su impacto. */
dashboardRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id;
    const orders = await prisma.order.findMany({
      where: { userId, status: { in: ['PAID', 'PENDING_PAYMENT'] } },
      include: { items: true },
    });
    const paid = orders.filter((o) => o.status === 'PAID');
    const rescued = paid.reduce((s, o) => s + o.items.reduce((t, i) => t + i.quantity, 0), 0);
    const wasteAvoidedKg = +paid.reduce((s, o) => s + o.wasteAvoidedKg, 0).toFixed(1);
    return ok(res, {
      orders: paid.length,
      pending: orders.length - paid.length,
      reservations: orders.filter((o) => o.mode === 'reserva').length,
      saved: paid.reduce((s, o) => s + o.savingsCop, 0),
      spent: paid.reduce((s, o) => s + o.totalCop, 0),
      rescued,
      wasteAvoidedKg,
      co2AvoidedKg: co2FromKg(wasteAvoidedKg),
      waterSavedL: waterFromKg(wasteAvoidedKg),
    });
  }),
);
