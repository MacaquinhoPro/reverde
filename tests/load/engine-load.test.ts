/**
 * Pruebas de carga del motor de Reverde.
 *
 * La app es un cliente: el Risk Score, las recomendaciones, el filtrado del
 * marketplace y las métricas de impacto se recalculan en el navegador en cada
 * render. Por eso el límite de escala no está en un servidor sino en estas
 * funciones. Cada escenario mide con un dataset mucho mayor que el de la demo
 * y falla si pasa del presupuesto de tiempo.
 *
 * Los presupuestos tienen ~3× de holgura sobre lo medido en un portátil de
 * desarrollo, así que un fallo indica una regresión real (p. ej. una función
 * que pasó de lineal a cuadrática), no ruido de la máquina.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAlertCopy,
  buildRecommendation,
  computeRisk,
  finalPrice,
  learnFromHistory,
} from '../../src/lib/ai';
import {
  aggregate,
  inventoryStats,
  monthOverMonth,
  riskByCategory,
  weeklySeries,
} from '../../src/lib/metrics';
import { ESTABLISHMENTS } from '../../src/data/establishments';
import { makeOrders, makeProducts, makePromos, makeSales, measure, report } from './_dataset';
import type { Product } from '../../src/types';

/* Tamaños muy por encima de la demo (≈52 productos, ≈700 ventas): una cadena
 * real con miles de SKU por establecimiento y dos meses de ventas. */
const INVENTARIO_GRANDE = 10_000;
const INVENTARIO_TABLERO = 2_000;
const VENTAS_GRANDES = 50_000;

describe('motor de riesgo bajo carga', () => {
  it(`calcula el Risk Score de ${INVENTARIO_GRANDE.toLocaleString('es-CO')} productos`, () => {
    const products = makeProducts(INVENTARIO_GRANDE);
    const budget = 80;
    const m = measure(() => {
      for (const p of products) computeRisk(p);
    });
    report('computeRisk × 10.000', m, budget);
    expect(m.median).toBeLessThan(budget);
  });

  it('escala de forma lineal (no cuadrática) al multiplicar el inventario por 10', () => {
    const chico = makeProducts(1_000, 7);
    const grande = makeProducts(10_000, 7);

    const tChico = measure(() => { for (const p of chico) computeRisk(p); }, 7).median;
    const tGrande = measure(() => { for (const p of grande) computeRisk(p); }, 7).median;

    const factor = tGrande / Math.max(tChico, 0.01);
    // eslint-disable-next-line no-console
    console.log(`  escalado 1.000 → 10.000 productos            factor ${factor.toFixed(1)}× (lineal ≈ 10×)`);
    expect(factor).toBeLessThan(25);
  });

  it(`arma el tablero completo (riesgo + recomendación + alerta) de ${INVENTARIO_TABLERO.toLocaleString('es-CO')} productos`, () => {
    const products = makeProducts(INVENTARIO_TABLERO);
    const history = makePromos(500);
    const budget = 150;

    const m = measure(() => {
      const scored = products.map((product) => {
        const risk = computeRisk(product);
        return { product, risk, recommendation: buildRecommendation(product, risk, history) };
      });
      scored.sort((a, b) => b.risk.score - a.risk.score);
      scored
        .filter(({ risk, product }) => risk.level !== 'bajo' && product.quantity > 0)
        .map(({ product, risk, recommendation }) => buildAlertCopy(product, risk, recommendation));
    }, 3);

    report('tablero admin × 2.000 (riesgo+IA+alertas)', m, budget);
    expect(m.median).toBeLessThan(budget);
  });

  it('aprende del histórico sin degradarse con 5.000 promociones', () => {
    const history = makePromos(5_000);
    const budget = 15;
    const m = measure(() => {
      for (const est of ESTABLISHMENTS) {
        void est;
        learnFromHistory('Lácteos', history);
        learnFromHistory('Panadería', history);
        learnFromHistory('Preparados', history);
      }
    }, 5);
    report('learnFromHistory × 18 sobre 5.000 registros', m, budget);
    expect(m.median).toBeLessThan(budget);
  });
});

describe('marketplace bajo carga', () => {
  const products = makeProducts(INVENTARIO_GRANDE, 11).map(
    (p): Product => ({ ...p, status: 'publicado', quantity: Math.max(1, p.quantity) }),
  );
  const estById = new Map(ESTABLISHMENTS.map((e) => [e.id, e]));

  it('filtra y ordena por relevancia 10.000 publicaciones', () => {
    const budget = 600;
    const m = measure(() => {
      const list = products.filter(
        (p) =>
          p.status === 'publicado' &&
          p.quantity > 0 &&
          p.name.toLowerCase().includes('a') &&
          (estById.get(p.establishmentId)?.distanceKm ?? 0) <= 5,
      );
      [...list].sort(
        (a, b) =>
          Number(b.featured ?? false) - Number(a.featured ?? false) ||
          computeRisk(b).score - computeRisk(a).score,
      );
    }, 3);
    report('marketplace filtrar+ordenar × 10.000', m, budget);
    expect(m.median).toBeLessThan(budget);
  });

  it('ordenar por precio y por vencimiento se mantiene rápido', () => {
    const budget = 600;
    const m = measure(() => {
      [...products].sort((a, b) => finalPrice(a) - finalPrice(b));
      [...products].sort((a, b) => computeRisk(a).daysLeft - computeRisk(b).daysLeft);
    }, 3);
    report('ordenar precio + vencimiento × 10.000', m, budget);
    expect(m.median).toBeLessThan(budget);
  });
});

describe('métricas de impacto bajo carga', () => {
  const sales = makeSales(VENTAS_GRANDES);

  it(`agrega ${VENTAS_GRANDES.toLocaleString('es-CO')} ventas`, () => {
    const budget = 20;
    const m = measure(() => aggregate(sales), 5);
    report('aggregate × 50.000 ventas', m, budget);
    expect(m.median).toBeLessThan(budget);
  });

  it('calcula la comparativa mensual y la serie semanal del dashboard', () => {
    const budget = 150;
    const m = measure(() => {
      monthOverMonth(sales);
      weeklySeries(sales);
    }, 5);
    report('monthOverMonth + weeklySeries × 50.000', m, budget);
    expect(m.median).toBeLessThan(budget);
  });

  it('calcula estadísticas e inventario por categoría de 10.000 productos', () => {
    const products = makeProducts(INVENTARIO_GRANDE, 21);
    const budget = 120;
    const m = measure(() => {
      inventoryStats(products);
      riskByCategory(products);
    }, 3);
    report('inventoryStats + riskByCategory × 10.000', m, budget);
    expect(m.median).toBeLessThan(budget);
  });

  it('el perfil del cliente no se degrada con 20.000 pedidos en el sistema', () => {
    const orders = makeOrders(20_000);
    const budget = 15;
    const m = measure(() => {
      const mine = orders.filter((o) => o.userId === 'u-cli-7');
      mine.reduce((s, o) => s + o.savings, 0);
      mine.reduce((s, o) => s + o.items.reduce((t, i) => t + i.qty, 0), 0);
    }, 5);
    report('clientMetrics sobre 20.000 pedidos', m, budget);
    expect(m.median).toBeLessThan(budget);
  });
});

describe('uso sostenido', () => {
  it('60 recálculos seguidos (navegación intensiva) mantienen el p95 por pasada', () => {
    const products = makeProducts(500, 31);
    const history = makePromos(200);
    const budgetP95 = 25;

    const m = measure(() => {
      for (const p of products) {
        const risk = computeRisk(p);
        buildRecommendation(p, risk, history);
      }
    }, 60);

    report('pasada completa × 500 productos (p95 de 60)', m, budgetP95);
    expect(m.p95).toBeLessThan(budgetP95);
    // Sin fugas ni degradación progresiva: las últimas pasadas no deben ser
    // mucho más lentas que las primeras.
    const primeras = m.samples.slice(0, 10).reduce((s, v) => s + v, 0) / 10;
    const ultimas = m.samples.slice(-10).reduce((s, v) => s + v, 0) / 10;
    // eslint-disable-next-line no-console
    console.log(`  degradación primeras 10 vs últimas 10         ${(ultimas / primeras).toFixed(2)}×`);
    expect(ultimas).toBeLessThan(primeras * 3 + 20);
  });

  it('no retiene memoria entre pasadas del tablero', () => {
    const products = makeProducts(2_000, 41);
    const history = makePromos(200);
    const antes = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10; i++) {
      products.map((p) => buildRecommendation(p, computeRisk(p), history));
    }
    globalThis.gc?.();

    const crecimientoMb = (process.memoryUsage().heapUsed - antes) / 1024 / 1024;
    // eslint-disable-next-line no-console
    console.log(`  crecimiento de heap tras 10 pasadas          ${crecimientoMb.toFixed(1)} MB`);
    expect(crecimientoMb).toBeLessThan(120);
  });
});
