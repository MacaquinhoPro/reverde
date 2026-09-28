import type { PromoOutcome, Sale } from '../types';
import { CATALOG } from './catalog';
import { ESTABLISHMENTS } from './establishments';
import { addDays, uid } from '../lib/format';

/** RNG determinista para que la demo siempre muestre las mismas cifras. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS = [
  'Sofía Herrera', 'Mateo Cárdenas', 'Valentina Gómez', 'Juan Pablo Niño',
  'Carolina Duarte', 'Esteban Lara', 'Natalia Pardo', 'Felipe Acosta',
  'Ana María Rojas', 'Sebastián Vargas', 'Laura Jiménez', 'Tomás Beltrán',
];

const KEYS = Object.keys(CATALOG);

/** Ventas históricas de los últimos 60 días para todos los establecimientos. */
export function buildSeedSales(): Sale[] {
  const rnd = mulberry32(20260922);
  const sales: Sale[] = [];

  for (let day = 59; day >= 0; day--) {
    // Más actividad en días recientes: la adopción de Reverde crece.
    // Crecimiento suave de adopción: ~+18 % de un mes al siguiente.
    const momentum = 1 + (59 - day) / 152;
    ESTABLISHMENTS.forEach((est, ei) => {
      // Redondeo estocástico: evita que el redondeo entero infle el crecimiento
      // mes a mes y mantiene la comparativa en un rango creíble.
      const exact = (0.95 + rnd() * 0.55) * momentum * (est.type === 'supermercado' ? 1.3 : 1);
      const perDay = Math.floor(exact) + (rnd() < exact % 1 ? 1 : 0);
      for (let k = 0; k < perDay; k++) {
        const key = KEYS[Math.floor(rnd() * KEYS.length)];
        const c = CATALOG[key];
        const discount = [20, 25, 30, 35, 40, 45][Math.floor(rnd() * 6)];
        const qty = 1 + Math.floor(rnd() * (c.isRescueBox ? 2 : 3));
        const soldPrice = Math.round((c.price * (1 - discount / 100)) / 50) * 50;
        const date = new Date(addDays(-day));
        date.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
        sales.push({
          id: uid('s'),
          date: date.toISOString(),
          productId: `p-${est.id}-${key}-h`,
          productName: c.name,
          emoji: c.emoji,
          photo: c.photo,
          customer: CUSTOMERS[(Math.floor(rnd() * CUSTOMERS.length) + ei) % CUSTOMERS.length],
          establishmentId: est.id,
          qty,
          originalPrice: c.price,
          soldPrice,
          discountPercent: discount,
          recovered: soldPrice * qty,
          wasteAvoidedKg: +(c.weightPerUnitKg * qty).toFixed(2),
          channel: rnd() > 0.22 ? 'marketplace' : 'tienda',
          seed: true,
        });
      }
    });
  }
  return sales.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/**
 * Memoria de aprendizaje: resultados de promociones pasadas.
 * De aquí sale el "basándonos en resultados anteriores…" de las recomendaciones.
 */
export function buildSeedPromoOutcomes(): PromoOutcome[] {
  const rnd = mulberry32(777);
  const base: Omit<PromoOutcome, 'id' | 'date'>[] = [
    { category: 'Lácteos', discountPercent: 30, sellThrough: 82, daysToSell: 2, establishmentId: 'sup-1' },
    { category: 'Lácteos', discountPercent: 30, sellThrough: 79, daysToSell: 2, establishmentId: 'sup-2' },
    { category: 'Lácteos', discountPercent: 15, sellThrough: 41, daysToSell: 4, establishmentId: 'sup-1' },
    { category: 'Lácteos', discountPercent: 45, sellThrough: 94, daysToSell: 1, establishmentId: 'sup-3' },
    { category: 'Frutas y verduras', discountPercent: 25, sellThrough: 74, daysToSell: 2, establishmentId: 'sup-1' },
    { category: 'Frutas y verduras', discountPercent: 40, sellThrough: 91, daysToSell: 1, establishmentId: 'sup-3' },
    { category: 'Frutas y verduras', discountPercent: 25, sellThrough: 69, daysToSell: 3, establishmentId: 'sup-2' },
    { category: 'Panadería', discountPercent: 40, sellThrough: 96, daysToSell: 1, establishmentId: 'res-2' },
    { category: 'Panadería', discountPercent: 20, sellThrough: 52, daysToSell: 2, establishmentId: 'res-2' },
    { category: 'Panadería', discountPercent: 35, sellThrough: 88, daysToSell: 1, establishmentId: 'sup-1' },
    { category: 'Preparados', discountPercent: 35, sellThrough: 90, daysToSell: 1, establishmentId: 'res-1' },
    { category: 'Preparados', discountPercent: 20, sellThrough: 48, daysToSell: 2, establishmentId: 'res-3' },
    { category: 'Preparados', discountPercent: 30, sellThrough: 81, daysToSell: 1, establishmentId: 'res-1' },
    { category: 'Carnes', discountPercent: 30, sellThrough: 86, daysToSell: 1, establishmentId: 'sup-3' },
    { category: 'Carnes', discountPercent: 15, sellThrough: 39, daysToSell: 3, establishmentId: 'res-1' },
    { category: 'Cajas de rescate', discountPercent: 35, sellThrough: 93, daysToSell: 1, establishmentId: 'res-2' },
    { category: 'Cajas de rescate', discountPercent: 30, sellThrough: 88, daysToSell: 1, establishmentId: 'sup-1' },
    { category: 'Bebidas', discountPercent: 20, sellThrough: 72, daysToSell: 2, establishmentId: 'sup-1' },
    { category: 'Bebidas', discountPercent: 35, sellThrough: 85, daysToSell: 1, establishmentId: 'res-2' },
  ];
  return base.map((b) => ({ ...b, id: uid('po'), date: addDays(-Math.floor(5 + rnd() * 50)), seed: true }));
}
