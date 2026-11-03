/**
 * Motor de Risk Score y recomendaciones.
 *
 * Es el mismo modelo heurístico que ya vivía en el frontend
 * (`src/lib/ai.ts`), movido al backend para que las alertas, las
 * recomendaciones y las métricas se calculen sobre los datos persistidos y
 * no sobre lo que tenga cargado el navegador. Las fórmulas se conservan tal
 * cual: los números que ve la persona usuaria no cambian.
 */

export type RiskLevel = 'bajo' | 'medio' | 'alto';

export type ActionType =
  | 'descuento'
  | 'combo'
  | 'publicar'
  | 'caja_rescate'
  | 'destacar'
  | 'donar'
  | 'venta_presencial';

export interface RiskFactor {
  label: string;
  detail: string;
  weight: number;
}

export interface ComputedRisk {
  score: number;
  level: RiskLevel;
  daysLeft: number;
  factors: RiskFactor[];
  wasteProbability: number;
  coverageDays: number;
}

export interface RiskInput {
  name: string;
  category: string;
  unit: string;
  quantity: number;
  dailySales: number;
  demandTrend: number;
  discountPercent: number;
  expiryDate: Date;
  status: string;
}

export interface PromoHistoryItem {
  category: string;
  discountPercent: number;
  sellThrough: number;
  daysToSell: number;
}

const CATEGORY_PERISHABILITY: Record<string, number> = {
  Preparados: 1.25,
  Panadería: 1.2,
  Lácteos: 1.05,
  'Frutas y verduras': 1.1,
  Carnes: 1.15,
  'Cajas de rescate': 0.95,
  Bebidas: 0.7,
};

export const RISK_THRESHOLDS = { medium: 40, high: 70 } as const;

export const levelFromScore = (score: number): RiskLevel =>
  score >= RISK_THRESHOLDS.high ? 'alto' : score >= RISK_THRESHOLDS.medium ? 'medio' : 'bajo';

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

const UNIT_PLURAL: Record<string, string> = {
  unidad: 'unidades',
  kg: 'kg',
  g: 'g',
  litro: 'litros',
  bandeja: 'bandejas',
  caja: 'cajas',
};

export const unitLabel = (unit: string, qty = 2): string =>
  qty === 1 ? unit : (UNIT_PLURAL[unit] ?? `${unit}s`);

export const qtyLabel = (qty: number, unit: string): string => `${qty} ${unitLabel(unit, qty)}`;

/** Días calendario hasta el vencimiento, con el mismo corte local que el frontend. */
export function daysUntil(date: Date, now = new Date()): number {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Precio final tras el descuento, redondeado a múltiplos de 50 COP. */
export const finalPrice = (originalPrice: number, discountPercent: number): number =>
  Math.round((originalPrice * (1 - discountPercent / 100)) / 50) * 50;

export function computeRisk(p: RiskInput, now = new Date()): ComputedRisk {
  const daysLeft = daysUntil(p.expiryDate, now);
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

/** Mejor descuento histórico por categoría (memoria de aprendizaje). */
export function learnFromHistory(
  category: string,
  history: PromoHistoryItem[],
): { discount: number; sellThrough: number; samples: number; days: number } | null {
  const relevant = history.filter((h) => h.category === category);
  if (relevant.length === 0) return null;

  const buckets = new Map<number, PromoHistoryItem[]>();
  relevant.forEach((h) => {
    const bucket = Math.round(h.discountPercent / 5) * 5;
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), h]);
  });

  let best = { discount: 0, sellThrough: 0, samples: 0, days: 0 };
  buckets.forEach((items, discount) => {
    const sellThrough = items.reduce((s, i) => s + i.sellThrough, 0) / items.length;
    const days = items.reduce((s, i) => s + i.daysToSell, 0) / items.length;
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

export function suggestDiscount(p: RiskInput, risk: ComputedRisk, history: PromoHistoryItem[]): number {
  const base =
    risk.score >= 85 ? 45 : risk.score >= 70 ? 35 : risk.score >= 55 ? 25 : risk.score >= 40 ? 20 : 10;
  const learned = learnFromHistory(p.category, history);
  const blended = learned ? Math.round((base * 0.6 + learned.discount * 0.4) / 5) * 5 : base;
  return Math.max(blended, p.discountPercent + (risk.level === 'alto' ? 5 : 0), 5);
}

export interface BuiltRecommendation {
  title: string;
  rationale: string;
  learningNote?: string;
  suggestedDiscount: number;
  confidence: number;
  actions: { type: ActionType; label: string; primary?: boolean }[];
}

export function buildRecommendation(
  p: RiskInput,
  risk: ComputedRisk,
  history: PromoHistoryItem[],
): BuiltRecommendation {
  const discount = suggestDiscount(p, risk, history);
  const learned = learnFromHistory(p.category, history);
  const published = p.status === 'publicado';

  const actions: BuiltRecommendation['actions'] = [];
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
        ? 'Aún hay margen de maniobra, pero al ritmo actual de ventas no se alcanza a rotar todo el inventario antes del vencimiento.'
        : 'El inventario rota a buen ritmo y alcanza a venderse antes del vencimiento. No es necesario sacrificar margen.';

  // «promoción» pierde la tilde en plural: concatenar «es» daba «promociónes».
  const promoLabel =
    learned && learned.samples === 1 ? 'promoción anterior' : 'promociones anteriores';
  const learningNote = learned
    ? `Basándonos en ${learned.samples} ${promoLabel} en ${p.category.toLowerCase()}, un descuento del ${learned.discount} % logró vender el ${learned.sellThrough} % del inventario en ${learned.days} ${learned.days === 1 ? 'día' : 'días'} antes del vencimiento.`
    : undefined;

  return {
    title,
    rationale,
    learningNote,
    suggestedDiscount: discount,
    actions,
    confidence: Math.min(96, 62 + Math.round(risk.score / 4) + (learned ? 8 : 0)),
  };
}

/** Texto de la alerta de vencimiento. */
export function buildAlertCopy(p: RiskInput, risk: ComputedRisk, suggestedDiscount: number) {
  const qtyText = `${qtyLabel(p.quantity, p.unit)} de ${p.name.toLowerCase()}`;
  if (risk.level === 'alto') {
    return {
      title: `${qtyText} ${risk.daysLeft <= 0 ? 'vencieron' : risk.daysLeft === 1 ? 'vencen mañana' : `vencen en ${risk.daysLeft} días`}`,
      body: `Probabilidad estimada de desperdicio: ${risk.wasteProbability} %. Recomendación: aplicar descuento del ${suggestedDiscount} % y publicar en Reverde.`,
    };
  }
  if (risk.level === 'medio') {
    return {
      title: `${qtyText} presentan baja rotación`,
      body: `Vence en ${risk.daysLeft} días y se necesitan ${risk.coverageDays.toFixed(0)} días para agotarlo. Recomendamos crear un combo o aplicar ${suggestedDiscount} % de descuento.`,
    };
  }
  return {
    title: `${qtyText} bajo control`,
    body: 'El ritmo de ventas alcanza a cubrir el inventario antes del vencimiento.',
  };
}

/** 1 kg de comida rescatada ≈ 2,5 kg de CO₂e evitados. */
export const co2FromKg = (kgFood: number) => +(kgFood * 2.5).toFixed(1);
/** 1 kg de comida ≈ 1.000 L de agua ahorrados en la cadena productiva. */
export const waterFromKg = (kgFood: number) => Math.round(kgFood * 1000);
