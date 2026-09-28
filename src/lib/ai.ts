/**
 * Motor de IA simulado de Reverde.
 *
 * No hay un modelo real: es un sistema heurístico explicable que imita el
 * comportamiento de un modelo predictivo. Calcula un Risk Score 0–100 a partir
 * de vencimiento, cobertura de stock, rotación, categoría y tendencia de demanda;
 * y genera recomendaciones que "aprenden" del histórico de promociones.
 */
import type {
  ActionType,
  Category,
  ComputedRisk,
  Product,
  PromoOutcome,
  Recommendation,
  RiskFactor,
  RiskLevel,
} from '../types';
import { daysUntil, qtyLabel } from './format';

/** Sensibilidad de cada categoría: cuánto pesa el vencimiento cercano. */
const CATEGORY_PERISHABILITY: Record<Category, number> = {
  'Preparados': 1.25,
  'Panadería': 1.2,
  'Lácteos': 1.05,
  'Frutas y verduras': 1.1,
  'Carnes': 1.15,
  'Cajas de rescate': 0.95,
  'Bebidas': 0.7,
};

export const RISK_THRESHOLDS = { medium: 40, high: 70 } as const;

export const levelFromScore = (score: number): RiskLevel =>
  score >= RISK_THRESHOLDS.high ? 'alto' : score >= RISK_THRESHOLDS.medium ? 'medio' : 'bajo';

export const RISK_META: Record<RiskLevel, { label: string; text: string; bg: string; ring: string; dot: string; hex: string }> = {
  bajo: { label: 'Bajo riesgo', text: 'text-risk-low', bg: 'bg-[#EAF6EF]', ring: 'ring-[#3F9E6B]/20', dot: 'bg-risk-low', hex: '#3F9E6B' },
  medio: { label: 'Riesgo medio', text: 'text-[#A9761A]', bg: 'bg-[#FDF3E1]', ring: 'ring-[#D99A2B]/25', dot: 'bg-risk-mid', hex: '#E0A81C' },
  alto: { label: 'Alto riesgo', text: 'text-[#B4453D]', bg: 'bg-[#FCEDEC]', ring: 'ring-[#D96A63]/25', dot: 'bg-risk-high', hex: '#C8453E' },
};

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

/** Precio final tras el descuento aplicado. */
export const finalPrice = (p: Product): number =>
  Math.round((p.originalPrice * (1 - p.discountPercent / 100)) / 50) * 50;

export const savingsOf = (p: Product): number => p.originalPrice - finalPrice(p);

/**
 * Risk Score = riesgo por vencimiento + riesgo por stock + riesgo por baja
 * rotación + patrones históricos (tendencia de demanda).
 */
export function computeRisk(p: Product): ComputedRisk {
  const daysLeft = daysUntil(p.expiryDate);
  const perish = CATEGORY_PERISHABILITY[p.category] ?? 1;
  const velocity = Math.max(p.dailySales, 0.35);
  const coverageDays = p.quantity / velocity;
  const factors: RiskFactor[] = [];

  // 1. Riesgo por vencimiento (0–58): crece muy rápido en los últimos días.
  const horizon = 14;
  const expiryBase = daysLeft <= 0 ? 60 : 60 * Math.pow(Math.max(0, 1 - daysLeft / horizon), 1.4);
  const expiryRisk = clamp(expiryBase * perish, 0, 58);
  factors.push({
    label: 'Proximidad al vencimiento',
    detail:
      daysLeft <= 0
        ? 'El producto ya alcanzó su fecha de vencimiento.'
        : `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} y la categoría ${p.category.toLowerCase()} pierde valor rápido.`,
    weight: Math.round(expiryRisk),
  });

  // 2. Riesgo por stock frente al tiempo disponible (0–30)
  const ratio = daysLeft <= 0 ? 3 : coverageDays / daysLeft;
  const stockRisk = clamp((ratio - 0.55) * 22, 0, 30);
  factors.push({
    label: 'Stock frente al tiempo restante',
    detail: `Quedan ${qtyLabel(p.quantity, p.unit)} y se venden ~${p.dailySales.toFixed(1)} por día: se necesitan ${coverageDays.toFixed(
      1,
    )} días para agotarlo${daysLeft > 0 ? ` y solo hay ${daysLeft}.` : '.'}`,
    weight: Math.round(stockRisk),
  });

  // 3. Riesgo por baja rotación (0–10)
  const rotationRisk = clamp((1 - Math.min(p.dailySales / 6, 1)) * 10, 0, 10);
  factors.push({
    label: 'Rotación histórica',
    detail:
      p.dailySales < 2
        ? `Rotación baja: histórico de ${p.dailySales.toFixed(1)} ventas por día.`
        : `Rotación saludable: ${p.dailySales.toFixed(1)} ventas por día en promedio.`,
    weight: Math.round(rotationRisk),
  });

  // 4. Patrón reciente de demanda (0–8)
  const trendRisk = clamp(-p.demandTrend * 8, 0, 8);
  factors.push({
    label: 'Demanda de la última semana',
    detail:
      p.demandTrend < -0.1
        ? `La demanda bajó ${Math.round(Math.abs(p.demandTrend) * 100)} % frente a la semana anterior.`
        : p.demandTrend > 0.1
          ? `La demanda subió ${Math.round(p.demandTrend * 100)} % frente a la semana anterior.`
          : 'La demanda se mantiene estable frente a la semana anterior.',
    weight: Math.round(trendRisk),
  });

  // El descuento ya aplicado reduce el riesgo: el producto se mueve más rápido.
  const discountRelief = Math.min(p.discountPercent * 0.32, 16);
  const raw = expiryRisk + stockRisk + rotationRisk + trendRisk - discountRelief;
  const score = Math.round(clamp(raw));
  const wasteProbability = Math.round(clamp(score * 0.95 + (daysLeft <= 1 ? 8 : 4), 0, 96));

  return {
    score,
    level: levelFromScore(score),
    daysLeft,
    factors: factors.sort((a, b) => b.weight - a.weight),
    wasteProbability,
    coverageDays,
  };
}

/** Peso total en kg del producto (para impacto de desperdicio evitado). */
export const productWeightKg = (p: Product, qty = p.quantity): number => qty * p.weightPerUnitKg;

/**
 * Aprendizaje simulado: revisa el histórico de promociones de la misma
 * categoría y devuelve el descuento que mejor sell-through consiguió.
 */
export function learnFromHistory(
  category: Category,
  history: PromoOutcome[],
): { discount: number; sellThrough: number; samples: number; days: number } | null {
  const relevant = history.filter((h) => h.category === category);
  if (relevant.length === 0) return null;

  const buckets = new Map<number, PromoOutcome[]>();
  relevant.forEach((h) => {
    const bucket = Math.round(h.discountPercent / 5) * 5;
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), h]);
  });

  let best = { discount: 0, sellThrough: 0, samples: 0, days: 0 };
  buckets.forEach((items, discount) => {
    const sellThrough = items.reduce((s, i) => s + i.sellThrough, 0) / items.length;
    const days = items.reduce((s, i) => s + i.daysToSell, 0) / items.length;
    // Se prefiere el descuento más bajo que logre un sell-through comparable.
    const utility = sellThrough - discount * 0.35;
    const bestUtility = best.sellThrough - best.discount * 0.35;
    if (best.samples === 0 || utility > bestUtility) {
      best = { discount, sellThrough: Math.round(sellThrough), samples: items.length, days: Math.round(days) };
    }
  });
  return best.samples ? best : null;
}

const ACTION_LABEL: Record<ActionType, string> = {
  descuento: 'Aplicar descuento',
  combo: 'Crear combo',
  publicar: 'Publicar en marketplace',
  caja_rescate: 'Crear caja de rescate',
  destacar: 'Destacar producto',
  donar: 'Donar',
  venta_presencial: 'Priorizar venta presencial',
};

export const actionLabel = (t: ActionType) => ACTION_LABEL[t];

/** Descuento sugerido base según el nivel de riesgo, ajustado por aprendizaje. */
export function suggestDiscount(p: Product, risk: ComputedRisk, history: PromoOutcome[]): number {
  const base =
    risk.score >= 85 ? 45 : risk.score >= 70 ? 35 : risk.score >= 55 ? 25 : risk.score >= 40 ? 20 : 10;
  const learned = learnFromHistory(p.category, history);
  const blended = learned ? Math.round((base * 0.6 + learned.discount * 0.4) / 5) * 5 : base;
  return Math.max(blended, p.discountPercent + (risk.level === 'alto' ? 5 : 0), 5);
}

/** Genera la recomendación completa, con explicabilidad y CTAs. */
export function buildRecommendation(
  p: Product,
  risk: ComputedRisk,
  history: PromoOutcome[],
): Recommendation {
  const discount = suggestDiscount(p, risk, history);
  const learned = learnFromHistory(p.category, history);
  const published = p.status === 'publicado';

  const actions: { type: ActionType; label: string; primary?: boolean }[] = [];
  if (risk.level === 'alto') {
    actions.push({ type: 'descuento', label: `Aplicar ${discount} % de descuento`, primary: true });
    if (!published) actions.push({ type: 'publicar', label: ACTION_LABEL.publicar });
    actions.push({ type: 'caja_rescate', label: ACTION_LABEL.caja_rescate });
    if (risk.daysLeft <= 1) actions.push({ type: 'donar', label: ACTION_LABEL.donar });
  } else if (risk.level === 'medio') {
    actions.push({ type: 'descuento', label: `Aplicar ${discount} % de descuento`, primary: true });
    actions.push({ type: 'combo', label: ACTION_LABEL.combo });
    if (!published) actions.push({ type: 'publicar', label: ACTION_LABEL.publicar });
  } else {
    actions.push({ type: 'venta_presencial', label: ACTION_LABEL.venta_presencial, primary: true });
    actions.push({ type: 'destacar', label: ACTION_LABEL.destacar });
    if (!published) actions.push({ type: 'publicar', label: ACTION_LABEL.publicar });
  }

  const title =
    risk.level === 'alto'
      ? `Aplicar ${discount} % de descuento y publicar hoy en Reverde`
      : risk.level === 'medio'
        ? `Aplicar ${discount} % o crear un combo para acelerar la rotación`
        : `Mantener precio y destacar ${p.name.toLowerCase()} en tienda`;

  const rationale =
    risk.level === 'alto'
      ? `Este producto tiene ${risk.wasteProbability} % de probabilidad de convertirse en desperdicio. Con ${discount} % de descuento el precio queda en un rango donde productos similares se agotaron antes de vencer.`
      : risk.level === 'medio'
        ? `Aún hay margen de maniobra, pero al ritmo actual de ventas no se alcanza a rotar todo el inventario antes del vencimiento.`
        : `El inventario rota a buen ritmo y alcanza a venderse antes del vencimiento. No es necesario sacrificar margen.`;

  const learningNote = learned
    ? `Basándonos en ${learned.samples} promoción${learned.samples === 1 ? '' : 'es'} anterior${
        learned.samples === 1 ? '' : 'es'
      } en ${p.category.toLowerCase()}, un descuento del ${learned.discount} % logró vender el ${learned.sellThrough} % del inventario en ${learned.days} ${learned.days === 1 ? 'día' : 'días'} antes del vencimiento.`
    : undefined;

  return {
    id: `rec_${p.id}`,
    productId: p.id,
    title,
    rationale,
    suggestedDiscount: discount,
    actions,
    learningNote,
    confidence: Math.min(96, 62 + Math.round(risk.score / 4) + (learned ? 8 : 0)),
  };
}

/** Texto de alerta resumido, listo para la bandeja de alertas. */
export function buildAlertCopy(p: Product, risk: ComputedRisk, rec: Recommendation) {
  const qtyText = `${qtyLabel(p.quantity, p.unit)} de ${p.name.toLowerCase()}`;
  if (risk.level === 'alto') {
    return {
      title: `${qtyText} ${risk.daysLeft <= 0 ? 'vencieron' : risk.daysLeft === 1 ? 'vencen mañana' : `vencen en ${risk.daysLeft} días`}`,
      body: `Probabilidad estimada de desperdicio: ${risk.wasteProbability} %. Recomendación: aplicar descuento del ${rec.suggestedDiscount} % y publicar en Reverde.`,
    };
  }
  if (risk.level === 'medio') {
    return {
      title: `${qtyText} presentan baja rotación`,
      body: `Vence en ${risk.daysLeft} días y se necesitan ${risk.coverageDays.toFixed(0)} días para agotarlo. Recomendamos crear un combo o aplicar ${rec.suggestedDiscount} % de descuento.`,
    };
  }
  return {
    title: `${qtyText} bajo control`,
    body: `El ritmo de ventas alcanza a cubrir el inventario antes del vencimiento.`,
  };
}
