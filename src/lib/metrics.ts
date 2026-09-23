import type { Order, Product, Sale } from '../types';
import { computeRisk, finalPrice, productWeightKg } from './ai';

export interface ImpactMetrics {
  rescued: number;
  wasteAvoidedKg: number;
  lossesAvoided: number;
  recovered: number;
  recoveryRate: number;
  marketplaceSales: number;
  orders: number;
}

const inRange = (iso: string, days: number) =>
  Date.now() - new Date(iso).getTime() <= days * 86_400_000;

const between = (iso: string, fromDays: number, toDays: number) => {
  const age = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return age >= toDays && age < fromDays;
};

export function aggregate(sales: Sale[]): ImpactMetrics {
  const rescued = sales.reduce((s, v) => s + v.qty, 0);
  const wasteAvoidedKg = sales.reduce((s, v) => s + v.wasteAvoidedKg, 0);
  const recovered = sales.reduce((s, v) => s + v.recovered, 0);
  const lossesAvoided = sales.reduce((s, v) => s + v.originalPrice * v.qty, 0);
  const marketplaceSales = sales.filter((s) => s.channel === 'marketplace').length;
  return {
    rescued,
    wasteAvoidedKg,
    recovered,
    lossesAvoided,
    recoveryRate: lossesAvoided ? (recovered / lossesAvoided) * 100 : 0,
    marketplaceSales,
    orders: sales.length,
  };
}

export const salesOf = (sales: Sale[], establishmentId?: string) =>
  establishmentId ? sales.filter((s) => s.establishmentId === establishmentId) : sales;

export const salesInLastDays = (sales: Sale[], days: number) => sales.filter((s) => inRange(s.date, days));

/** Variación porcentual del mes actual frente al mes anterior. */
export function monthOverMonth(sales: Sale[]) {
  const current = aggregate(sales.filter((s) => inRange(s.date, 30)));
  const previous = aggregate(sales.filter((s) => between(s.date, 60, 30)));
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);
  return {
    current,
    previous,
    rescuedDelta: delta(current.rescued, previous.rescued),
    wasteDelta: delta(current.wasteAvoidedKg, previous.wasteAvoidedKg),
    recoveredDelta: delta(current.recovered, previous.recovered),
    lossesDelta: delta(current.lossesAvoided, previous.lossesAvoided),
    extraRecovered: current.recovered - previous.recovered,
  };
}

/** Serie semanal (últimas 8 semanas) para las gráficas del dashboard. */
export function weeklySeries(sales: Sale[], weeks = 8) {
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    label: i === weeks - 1 ? 'Esta sem.' : `S${i + 1}`,
    weeksAgo: weeks - 1 - i,
    wasteAvoidedKg: 0,
    recovered: 0,
    rescued: 0,
    marketplace: 0,
  }));
  sales.forEach((s) => {
    const weeksAgo = Math.floor((Date.now() - new Date(s.date).getTime()) / (7 * 86_400_000));
    const bucket = buckets.find((b) => b.weeksAgo === weeksAgo);
    if (!bucket) return;
    bucket.wasteAvoidedKg += s.wasteAvoidedKg;
    bucket.recovered += s.recovered;
    bucket.rescued += s.qty;
    if (s.channel === 'marketplace') bucket.marketplace += s.qty;
  });
  return buckets.map((b) => ({ ...b, wasteAvoidedKg: +b.wasteAvoidedKg.toFixed(1) }));
}

export interface InventoryStats {
  total: number;
  units: number;
  high: number;
  medium: number;
  low: number;
  expiringSoon: number;
  published: number;
  inventoryValue: number;
  valueAtRisk: number;
}

export function inventoryStats(products: Product[]): InventoryStats {
  let high = 0, medium = 0, low = 0, expiringSoon = 0, valueAtRisk = 0;
  products.forEach((p) => {
    const r = computeRisk(p);
    if (r.level === 'alto') { high++; valueAtRisk += finalPrice(p) * p.quantity; }
    else if (r.level === 'medio') { medium++; valueAtRisk += finalPrice(p) * p.quantity * 0.4; }
    else low++;
    if (r.daysLeft <= 3) expiringSoon++;
  });
  return {
    total: products.length,
    units: products.reduce((s, p) => s + p.quantity, 0),
    high,
    medium,
    low,
    expiringSoon,
    published: products.filter((p) => p.status === 'publicado').length,
    inventoryValue: products.reduce((s, p) => s + finalPrice(p) * p.quantity, 0),
    valueAtRisk,
  };
}

/** Categorías con más riesgo acumulado, para el panel de priorización. */
export function riskByCategory(products: Product[]) {
  const map = new Map<string, { category: string; score: number; items: number; kg: number }>();
  products.forEach((p) => {
    const r = computeRisk(p);
    const entry = map.get(p.category) ?? { category: p.category, score: 0, items: 0, kg: 0 };
    entry.score += r.score;
    entry.items += 1;
    if (r.level !== 'bajo') entry.kg += productWeightKg(p);
    map.set(p.category, entry);
  });
  return [...map.values()]
    .map((e) => ({ ...e, score: Math.round(e.score / e.items), kg: +e.kg.toFixed(1) }))
    .sort((a, b) => b.score - a.score);
}

export function clientMetrics(orders: Order[], userId: string) {
  const mine = orders.filter((o) => o.userId === userId);
  return {
    orders: mine.length,
    reservations: mine.filter((o) => o.mode === 'reserva').length,
    saved: mine.reduce((s, o) => s + o.savings, 0),
    rescued: mine.reduce((s, o) => s + o.items.reduce((t, i) => t + i.qty, 0), 0),
    wasteAvoidedKg: +mine.reduce((s, o) => s + o.wasteAvoidedKg, 0).toFixed(1),
    spent: mine.reduce((s, o) => s + o.total, 0),
  };
}

/** 1 kg de comida rescatada ≈ 2,5 kg de CO₂e que no se emiten. */
export const co2FromKg = (kgFood: number) => +(kgFood * 2.5).toFixed(1);
/** 1 kg de comida ≈ 1.000 litros de agua ahorrados en la cadena productiva. */
export const waterFromKg = (kgFood: number) => Math.round(kgFood * 1000);
