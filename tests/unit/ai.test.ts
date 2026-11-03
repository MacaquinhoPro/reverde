import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  buildAlertCopy,
  buildRecommendation,
  computeRisk,
  finalPrice,
  learnFromHistory,
  levelFromScore,
  productWeightKg,
  RISK_THRESHOLDS,
  savingsOf,
  suggestDiscount,
} from '../../src/lib/ai';
import { buildSeedPromoOutcomes } from '../../src/data/history';
import { addDays } from '../../src/lib/format';
import type { ComputedRisk, PromoOutcome } from '../../src/types';
import { makeProduct, makePromo } from '../helpers/factories';

describe('finalPrice / savingsOf', () => {
  it('aplica el descuento y redondea a múltiplos de 50', () => {
    expect(finalPrice(makeProduct({ originalPrice: 5900, discountPercent: 35 }))).toBe(3850);
    expect(finalPrice(makeProduct({ originalPrice: 4500, discountPercent: 0 }))).toBe(4500);
    expect(finalPrice(makeProduct({ originalPrice: 12900, discountPercent: 40 }))).toBe(7750);
  });

  it('el redondeo nunca se desvía más de $25 del precio exacto', () => {
    for (const price of [1990, 4530, 7777, 12345]) {
      for (const discount of [0, 15, 23, 40, 80]) {
        const exact = price * (1 - discount / 100);
        expect(Math.abs(finalPrice(makeProduct({ originalPrice: price, discountPercent: discount })) - exact))
          .toBeLessThanOrEqual(25);
      }
    }
  });

  it('savingsOf es la diferencia que ve el cliente', () => {
    expect(savingsOf(makeProduct({ originalPrice: 5900, discountPercent: 35 }))).toBe(2050);
    expect(savingsOf(makeProduct({ originalPrice: 4500, discountPercent: 0 }))).toBe(0);
  });
});

describe('levelFromScore', () => {
  it('respeta los umbrales publicados', () => {
    expect(RISK_THRESHOLDS).toEqual({ medium: 40, high: 70 });
    expect(levelFromScore(0)).toBe('bajo');
    expect(levelFromScore(39)).toBe('bajo');
    expect(levelFromScore(40)).toBe('medio');
    expect(levelFromScore(69)).toBe('medio');
    expect(levelFromScore(70)).toBe('alto');
    expect(levelFromScore(100)).toBe('alto');
  });
});

describe('computeRisk', () => {
  it('un producto con buena rotación y vencimiento lejano queda en bajo riesgo', () => {
    const risk = computeRisk(makeProduct());
    expect(risk.daysLeft).toBe(12);
    expect(risk.score).toBe(4);
    expect(risk.level).toBe('bajo');
    expect(risk.wasteProbability).toBe(8);
  });

  it('un producto vencido satura el riesgo por vencimiento y stock', () => {
    const risk = computeRisk(makeProduct({ expiryDate: addDays(-1) }));
    expect(risk.daysLeft).toBe(-1);
    expect(risk.score).toBe(88);
    expect(risk.level).toBe('alto');
    expect(risk.wasteProbability).toBe(92);
  });

  it('el score siempre queda entre 0 y 100 y coincide con su nivel', () => {
    const casos = [-5, 0, 1, 3, 7, 14, 30].flatMap((d) =>
      [0, 1, 6, 40].flatMap((ventas) =>
        [0, 30, 80].map((desc) =>
          makeProduct({ expiryDate: addDays(d), dailySales: ventas, discountPercent: desc, quantity: 50 }),
        ),
      ),
    );
    for (const p of casos) {
      const r = computeRisk(p);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.level).toBe(levelFromScore(r.score));
      expect(r.wasteProbability).toBeLessThanOrEqual(96);
      expect(Number.isFinite(r.coverageDays)).toBe(true);
    }
  });

  it('acercarse al vencimiento nunca baja el riesgo', () => {
    const scores = [14, 10, 7, 5, 3, 2, 1, 0, -1].map(
      (d) => computeRisk(makeProduct({ expiryDate: addDays(d) })).score,
    );
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
  });

  it('un descuento mayor alivia el riesgo, con tope de 16 puntos', () => {
    const base = computeRisk(makeProduct({ expiryDate: addDays(2), discountPercent: 0 })).score;
    const medio = computeRisk(makeProduct({ expiryDate: addDays(2), discountPercent: 25 })).score;
    const alto = computeRisk(makeProduct({ expiryDate: addDays(2), discountPercent: 80 })).score;
    expect(medio).toBeLessThan(base);
    expect(alto).toBeLessThan(medio);
    expect(base - alto).toBeLessThanOrEqual(16);
  });

  it('más stock del que se puede vender sube el riesgo', () => {
    const poco = computeRisk(makeProduct({ expiryDate: addDays(3), quantity: 3 })).score;
    const mucho = computeRisk(makeProduct({ expiryDate: addDays(3), quantity: 300 })).score;
    expect(mucho).toBeGreaterThan(poco);
  });

  it('no divide por cero cuando el producto no tiene ventas', () => {
    const risk = computeRisk(makeProduct({ dailySales: 0, quantity: 10, expiryDate: addDays(3) }));
    expect(Number.isFinite(risk.coverageDays)).toBe(true);
    expect(risk.coverageDays).toBeCloseTo(10 / 0.35, 5);
  });

  it('la demanda a la baja suma riesgo y la demanda al alza no resta', () => {
    const cae = computeRisk(makeProduct({ expiryDate: addDays(4), demandTrend: -1 })).score;
    const estable = computeRisk(makeProduct({ expiryDate: addDays(4), demandTrend: 0 })).score;
    const sube = computeRisk(makeProduct({ expiryDate: addDays(4), demandTrend: 1 })).score;
    expect(cae).toBeGreaterThan(estable);
    expect(sube).toBe(estable);
  });

  it('las categorías perecederas puntúan más alto que las bebidas', () => {
    const bebida = computeRisk(makeProduct({ category: 'Bebidas', expiryDate: addDays(3) })).score;
    const preparado = computeRisk(makeProduct({ category: 'Preparados', expiryDate: addDays(3) })).score;
    expect(preparado).toBeGreaterThan(bebida);
  });

  it('devuelve los cuatro factores ordenados por peso, listos para explicar', () => {
    const risk = computeRisk(makeProduct({ expiryDate: addDays(1), quantity: 40, dailySales: 1, demandTrend: -0.4 }));
    expect(risk.factors).toHaveLength(4);
    expect(risk.factors.map((f) => f.label).sort()).toEqual(
      [
        'Demanda de la última semana',
        'Proximidad al vencimiento',
        'Rotación histórica',
        'Stock frente al tiempo restante',
      ].sort(),
    );
    for (let i = 1; i < risk.factors.length; i++) {
      expect(risk.factors[i].weight).toBeLessThanOrEqual(risk.factors[i - 1].weight);
    }
    for (const f of risk.factors) expect(f.detail.length).toBeGreaterThan(10);
  });

  it('el detalle del vencimiento concuerda con los días restantes', () => {
    expect(computeRisk(makeProduct({ expiryDate: addDays(1) })).factors.find((f) => f.label === 'Proximidad al vencimiento')!.detail)
      .toContain('Vence en 1 día ');
    expect(computeRisk(makeProduct({ expiryDate: addDays(-2) })).factors[0].detail)
      .toContain('ya alcanzó su fecha de vencimiento');
  });
});

describe('productWeightKg', () => {
  it('usa la cantidad en stock o la cantidad indicada', () => {
    const p = makeProduct({ quantity: 10, weightPerUnitKg: 0.25 });
    expect(productWeightKg(p)).toBeCloseTo(2.5, 5);
    expect(productWeightKg(p, 4)).toBeCloseTo(1, 5);
  });
});

describe('learnFromHistory', () => {
  it('sin histórico de la categoría devuelve null', () => {
    expect(learnFromHistory('Carnes', [])).toBeNull();
    expect(learnFromHistory('Carnes', [makePromo({ category: 'Lácteos' })])).toBeNull();
  });

  it('agrupa los descuentos en buckets de 5 puntos', () => {
    const history: PromoOutcome[] = [
      makePromo({ discountPercent: 32, sellThrough: 70, daysToSell: 2 }),
      makePromo({ discountPercent: 28, sellThrough: 80, daysToSell: 4 }),
    ];
    const learned = learnFromHistory('Lácteos', history)!;
    expect(learned.discount).toBe(30);
    expect(learned.samples).toBe(2);
    expect(learned.sellThrough).toBe(75);
    expect(learned.days).toBe(3);
  });

  it('prefiere el descuento más bajo cuando el sell-through es comparable', () => {
    const learned = learnFromHistory('Lácteos', [
      makePromo({ discountPercent: 20, sellThrough: 80 }),
      makePromo({ discountPercent: 40, sellThrough: 85 }),
    ])!;
    expect(learned.discount).toBe(20);
  });

  it('acepta sacrificar margen si el salto de sell-through lo justifica', () => {
    const learned = learnFromHistory('Lácteos', [
      makePromo({ discountPercent: 20, sellThrough: 40 }),
      makePromo({ discountPercent: 40, sellThrough: 95 }),
    ])!;
    expect(learned.discount).toBe(40);
  });

  it('sobre los datos semilla de Lácteos elige el 45 % (94 % de sell-through)', () => {
    const learned = learnFromHistory('Lácteos', buildSeedPromoOutcomes())!;
    expect(learned).toEqual({ discount: 45, sellThrough: 94, samples: 1, days: 1 });
  });
});

const risk = (score: number): ComputedRisk => ({
  score,
  level: levelFromScore(score),
  daysLeft: 2,
  factors: [],
  wasteProbability: score,
  coverageDays: 5,
});

describe('suggestDiscount', () => {
  it('escala con el riesgo cuando no hay histórico', () => {
    const p = makeProduct();
    expect(suggestDiscount(p, risk(90), [])).toBe(45);
    expect(suggestDiscount(p, risk(75), [])).toBe(35);
    expect(suggestDiscount(p, risk(60), [])).toBe(25);
    expect(suggestDiscount(p, risk(45), [])).toBe(20);
    expect(suggestDiscount(p, risk(10), [])).toBe(10);
  });

  it('nunca sugiere menos del descuento ya aplicado', () => {
    const p = makeProduct({ discountPercent: 40 });
    expect(suggestDiscount(p, risk(10), [])).toBeGreaterThanOrEqual(40);
  });

  it('en riesgo alto sube al menos 5 puntos sobre el descuento vigente', () => {
    const p = makeProduct({ discountPercent: 50 });
    expect(suggestDiscount(p, risk(95), [])).toBe(55);
  });

  it('nunca baja del 5 %', () => {
    expect(suggestDiscount(makeProduct({ discountPercent: 0 }), risk(0), [])).toBeGreaterThanOrEqual(5);
  });

  it('mezcla la base con lo aprendido y redondea a múltiplos de 5', () => {
    const p = makeProduct({ discountPercent: 0 });
    const history = [makePromo({ discountPercent: 20, sellThrough: 90, daysToSell: 1 })];
    // base 35 (riesgo 75) * 0.6 + 20 * 0.4 = 29 → 30
    expect(suggestDiscount(p, risk(75), history)).toBe(30);
  });
});

describe('buildRecommendation', () => {
  it('en riesgo alto propone descuento, publicar y caja de rescate', () => {
    const p = makeProduct({ expiryDate: addDays(0), quantity: 60, dailySales: 1 });
    const r = computeRisk(p);
    expect(r.level).toBe('alto');
    const rec = buildRecommendation(p, r, []);
    const tipos = rec.actions.map((a) => a.type);
    expect(tipos).toContain('descuento');
    expect(tipos).toContain('publicar');
    expect(tipos).toContain('caja_rescate');
    expect(tipos).toContain('donar'); // vence hoy
    expect(rec.actions[0]).toMatchObject({ type: 'descuento', primary: true });
    expect(rec.id).toBe(`rec_${p.id}`);
    expect(rec.productId).toBe(p.id);
    expect(rec.title).toContain(`${rec.suggestedDiscount} %`);
    expect(rec.rationale).toContain(`${r.wasteProbability} %`);
  });

  it('no ofrece publicar lo que ya está publicado', () => {
    const p = makeProduct({ expiryDate: addDays(0), quantity: 60, dailySales: 1, status: 'publicado' });
    const rec = buildRecommendation(p, computeRisk(p), []);
    expect(rec.actions.map((a) => a.type)).not.toContain('publicar');
  });

  it('no propone donar si aún quedan varios días', () => {
    const p = makeProduct({ expiryDate: addDays(4), quantity: 200, dailySales: 0.5 });
    const r = computeRisk(p);
    expect(r.level).toBe('alto');
    expect(buildRecommendation(p, r, []).actions.map((a) => a.type)).not.toContain('donar');
  });

  it('en riesgo medio propone combo', () => {
    const p = makeProduct({ expiryDate: addDays(6), quantity: 20, dailySales: 3 });
    const r = computeRisk(p);
    expect(r.level).toBe('medio');
    const rec = buildRecommendation(p, r, []);
    expect(rec.actions.map((a) => a.type)).toContain('combo');
    expect(rec.title).toContain('combo');
  });

  it('en riesgo bajo protege el margen', () => {
    const p = makeProduct();
    const rec = buildRecommendation(p, computeRisk(p), []);
    expect(rec.actions[0]).toMatchObject({ type: 'venta_presencial', primary: true });
    expect(rec.rationale).toContain('No es necesario sacrificar margen');
  });

  it('cita el histórico cuando existe y sube la confianza', () => {
    const p = makeProduct({ expiryDate: addDays(1), quantity: 40, dailySales: 1 });
    const r = computeRisk(p);
    const sin = buildRecommendation(p, r, []);
    const con = buildRecommendation(p, r, [makePromo({ discountPercent: 30, sellThrough: 88, daysToSell: 2 })]);
    expect(sin.learningNote).toBeUndefined();
    expect(con.learningNote).toContain('30 %');
    expect(con.learningNote).toContain('88 %');
    expect(con.confidence).toBe(sin.confidence + 8);
  });

  it('singulariza el texto del histórico con una sola promoción', () => {
    const p = makeProduct({ expiryDate: addDays(1) });
    const rec = buildRecommendation(p, computeRisk(p), [makePromo({ daysToSell: 1 })]);
    expect(rec.learningNote).toContain('1 promoción anterior');
    expect(rec.learningNote).toContain('1 día');
  });

  it('la confianza nunca pasa de 96', () => {
    const p = makeProduct({ expiryDate: addDays(-3), quantity: 400, dailySales: 0.1, demandTrend: -1 });
    const rec = buildRecommendation(p, computeRisk(p), [makePromo()]);
    expect(rec.confidence).toBeLessThanOrEqual(96);
  });
});

describe('buildAlertCopy', () => {
  it('en riesgo alto titula con el vencimiento y cuantifica la probabilidad', () => {
    const p = makeProduct({ expiryDate: addDays(1), quantity: 11, dailySales: 0.5 });
    const r = computeRisk(p);
    const copy = buildAlertCopy(p, r, buildRecommendation(p, r, []));
    expect(copy.title).toBe('11 unidades de yogur natural vencen mañana');
    expect(copy.body).toContain(`${r.wasteProbability} %`);
  });

  it('usa "vencieron" cuando ya pasó la fecha', () => {
    const p = makeProduct({ expiryDate: addDays(-2), quantity: 1, dailySales: 0.5 });
    const r = computeRisk(p);
    expect(buildAlertCopy(p, r, buildRecommendation(p, r, [])).title).toBe(
      '1 unidad de yogur natural vencieron',
    );
  });

  it('en riesgo medio habla de rotación', () => {
    const p = makeProduct({ expiryDate: addDays(6), quantity: 20, dailySales: 3 });
    const r = computeRisk(p);
    const copy = buildAlertCopy(p, r, buildRecommendation(p, r, []));
    expect(r.level).toBe('medio');
    expect(copy.title).toContain('baja rotación');
    expect(copy.body).toContain('Vence en 6 días');
  });

  it('en riesgo bajo informa que todo está bajo control', () => {
    const p = makeProduct();
    const r = computeRisk(p);
    expect(buildAlertCopy(p, r, buildRecommendation(p, r, [])).title).toContain('bajo control');
  });
});

describe('actionLabel', () => {
  it('traduce cada acción a su etiqueta de interfaz', () => {
    expect(actionLabel('descuento')).toBe('Aplicar descuento');
    expect(actionLabel('caja_rescate')).toBe('Crear caja de rescate');
    expect(actionLabel('venta_presencial')).toBe('Priorizar venta presencial');
  });
});
