/** Generación determinista de datasets grandes para las pruebas de carga. */
import { CATALOG } from '../../src/data/catalog';
import { ESTABLISHMENTS } from '../../src/data/establishments';
import { addDays } from '../../src/lib/format';
import type { Order, Product, PromoOutcome, Sale } from '../../src/types';

/** RNG determinista: la misma corrida produce las mismas cifras. */
export function rng(seed = 12345) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = Object.keys(CATALOG);
const STATUSES: Product['status'][] = ['en_inventario', 'publicado', 'publicado', 'agotado'];

export function makeProducts(n: number, seed = 1): Product[] {
  const rnd = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const c = CATALOG[KEYS[Math.floor(rnd() * KEYS.length)]];
    const est = ESTABLISHMENTS[i % ESTABLISHMENTS.length];
    return {
      id: `load-p-${i}`,
      name: c.name,
      description: c.description,
      category: c.category,
      emoji: c.emoji,
      image: c.image,
      photo: c.photo,
      quantity: 1 + Math.floor(rnd() * 60),
      unit: c.unit,
      weightPerUnitKg: c.weightPerUnitKg,
      entryDate: addDays(-Math.floor(rnd() * 20)),
      expiryDate: addDays(Math.floor(rnd() * 18) - 2),
      originalPrice: c.price,
      discountPercent: [0, 20, 25, 30, 35, 40, 45][Math.floor(rnd() * 7)],
      establishmentId: est.id,
      status: STATUSES[Math.floor(rnd() * STATUSES.length)],
      dailySales: +(rnd() * 14).toFixed(1),
      demandTrend: +(rnd() * 2 - 1).toFixed(2),
      featured: rnd() > 0.9,
      createdBy: 'seed',
    } satisfies Product;
  });
}

export function makeSales(n: number, seed = 2): Sale[] {
  const rnd = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const c = CATALOG[KEYS[Math.floor(rnd() * KEYS.length)]];
    const qty = 1 + Math.floor(rnd() * 3);
    const discount = [20, 25, 30, 35, 40, 45][Math.floor(rnd() * 6)];
    const soldPrice = Math.round((c.price * (1 - discount / 100)) / 50) * 50;
    return {
      id: `load-s-${i}`,
      date: addDays(-Math.floor(rnd() * 80)),
      productId: `load-p-${i % 1000}`,
      productName: c.name,
      emoji: c.emoji,
      customer: `Cliente ${i % 500}`,
      establishmentId: ESTABLISHMENTS[i % ESTABLISHMENTS.length].id,
      qty,
      originalPrice: c.price,
      soldPrice,
      discountPercent: discount,
      recovered: soldPrice * qty,
      wasteAvoidedKg: +(c.weightPerUnitKg * qty).toFixed(2),
      channel: rnd() > 0.25 ? 'marketplace' : 'tienda',
      seed: true,
    } satisfies Sale;
  });
}

export function makePromos(n: number, seed = 3): PromoOutcome[] {
  const rnd = rng(seed);
  const categories = [...new Set(Object.values(CATALOG).map((c) => c.category))];
  return Array.from({ length: n }, (_, i) => ({
    id: `load-po-${i}`,
    category: categories[Math.floor(rnd() * categories.length)],
    discountPercent: [15, 20, 25, 30, 35, 40, 45][Math.floor(rnd() * 7)],
    sellThrough: 30 + Math.floor(rnd() * 70),
    daysToSell: 1 + Math.floor(rnd() * 4),
    establishmentId: ESTABLISHMENTS[i % ESTABLISHMENTS.length].id,
    date: addDays(-Math.floor(rnd() * 60)),
    seed: true,
  }));
}

export function makeOrders(n: number, seed = 4): Order[] {
  const rnd = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const qty = 1 + Math.floor(rnd() * 4);
    const unitPrice = 2000 + Math.floor(rnd() * 8000);
    return {
      id: `load-o-${i}`,
      code: `RV-L${i}`,
      userId: `u-cli-${i % 50}`,
      userName: `Cliente ${i % 50}`,
      createdAt: addDays(-Math.floor(rnd() * 60)),
      mode: rnd() > 0.7 ? 'reserva' : 'compra',
      payment: 'tarjeta',
      items: [
        {
          productId: `load-p-${i % 1000}`,
          name: 'Producto',
          emoji: '🥛',
          image: 'from-white to-white',
          qty,
          unitOriginalPrice: unitPrice * 2,
          unitPrice,
          establishmentId: ESTABLISHMENTS[i % ESTABLISHMENTS.length].id,
          weightKg: 0.25 * qty,
        },
      ],
      total: unitPrice * qty,
      savings: unitPrice * qty,
      wasteAvoidedKg: 0.25 * qty,
      establishmentIds: [ESTABLISHMENTS[i % ESTABLISHMENTS.length].id],
      status: 'confirmado',
      pickupWindow: 'Hoy, 12:00 – 21:00',
    } satisfies Order;
  });
}

/** Mide `fn` y devuelve la mediana, p95 y media en milisegundos. */
export function measure(fn: () => void, iterations = 5) {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
    max: sorted[sorted.length - 1],
    mean: samples.reduce((s, v) => s + v, 0) / samples.length,
  };
}

export const report = (label: string, m: ReturnType<typeof measure>, budget: number) => {
  const fmt = (v: number) => `${v.toFixed(1)} ms`;
  // eslint-disable-next-line no-console
  console.log(
    `  ${label.padEnd(46)} mediana ${fmt(m.median).padStart(9)} · p95 ${fmt(m.p95).padStart(9)} · presupuesto ${fmt(budget)}`,
  );
};
