import { describe, expect, it } from 'vitest';
import { buildAlertCopy, buildRecommendation, computeRisk, finalPrice, learnFromHistory, levelFromScore } from '../domain/risk.ts';

const base = {
  name: 'Yogur natural',
  category: 'Lácteos',
  unit: 'unidad',
  quantity: 20,
  dailySales: 2,
  demandTrend: 0,
  discountPercent: 0,
  expiryDate: new Date(),
  status: 'en_inventario',
};

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
};

describe('Risk Score', () => {
  it('sube cuanto más cerca está el vencimiento', () => {
    const lejano = computeRisk({ ...base, expiryDate: inDays(12) }).score;
    const medio = computeRisk({ ...base, expiryDate: inDays(5) }).score;
    const urgente = computeRisk({ ...base, expiryDate: inDays(1) }).score;
    expect(lejano).toBeLessThan(medio);
    expect(medio).toBeLessThan(urgente);
  });

  it('clasifica el nivel según los umbrales documentados', () => {
    expect(levelFromScore(10)).toBe('bajo');
    expect(levelFromScore(40)).toBe('medio');
    expect(levelFromScore(70)).toBe('alto');
    expect(levelFromScore(100)).toBe('alto');
  });

  it('un descuento ya aplicado baja el riesgo', () => {
    const sin = computeRisk({ ...base, expiryDate: inDays(2) }).score;
    const con = computeRisk({ ...base, expiryDate: inDays(2), discountPercent: 40 }).score;
    expect(con).toBeLessThan(sin);
  });

  it('más stock del que se alcanza a vender sube el riesgo', () => {
    const poco = computeRisk({ ...base, expiryDate: inDays(3), quantity: 4 }).score;
    const mucho = computeRisk({ ...base, expiryDate: inDays(3), quantity: 60 }).score;
    expect(mucho).toBeGreaterThan(poco);
  });

  it('explica el puntaje con factores ordenados por peso', () => {
    const risk = computeRisk({ ...base, expiryDate: inDays(1) });
    expect(risk.factors.length).toBe(4);
    expect(risk.factors[0].weight).toBeGreaterThanOrEqual(risk.factors[3].weight);
    expect(risk.factors.every((f) => f.detail.length > 10)).toBe(true);
  });

  it('acota el puntaje entre 0 y 100 incluso con datos extremos', () => {
    const vencido = computeRisk({ ...base, expiryDate: inDays(-10), quantity: 9999, dailySales: 0 });
    expect(vencido.score).toBeLessThanOrEqual(100);
    expect(vencido.score).toBeGreaterThanOrEqual(0);
    expect(vencido.wasteProbability).toBeLessThanOrEqual(96);
  });
});

describe('precio final', () => {
  it('aplica el descuento y redondea a múltiplos de 50 COP', () => {
    expect(finalPrice(10_000, 0)).toBe(10_000);
    expect(finalPrice(10_000, 35)).toBe(6500);
    expect(finalPrice(4500, 35)).toBe(2950);
  });
});

describe('recomendaciones', () => {
  it('con riesgo alto propone descuento como acción principal', () => {
    const input = { ...base, expiryDate: inDays(1), quantity: 40 };
    const risk = computeRisk(input);
    const rec = buildRecommendation(input, risk, []);
    expect(risk.level).toBe('alto');
    expect(rec.actions[0].type).toBe('descuento');
    expect(rec.actions[0].primary).toBe(true);
    expect(rec.actions.map((a) => a.type)).toContain('caja_rescate');
  });

  it('con riesgo bajo no sacrifica margen', () => {
    const input = { ...base, expiryDate: inDays(14), quantity: 4, dailySales: 8 };
    const risk = computeRisk(input);
    const rec = buildRecommendation(input, risk, []);
    expect(risk.level).toBe('bajo');
    expect(rec.actions[0].type).toBe('venta_presencial');
  });

  it('aprende del histórico: cita promociones anteriores de la categoría', () => {
    const history = [
      { category: 'Lácteos', discountPercent: 30, sellThrough: 82, daysToSell: 2 },
      { category: 'Lácteos', discountPercent: 30, sellThrough: 78, daysToSell: 2 },
    ];
    expect(learnFromHistory('Lácteos', history)).toMatchObject({ discount: 30, samples: 2 });
    expect(learnFromHistory('Carnes', history)).toBeNull();

    const input = { ...base, expiryDate: inDays(2) };
    const rec = buildRecommendation(input, computeRisk(input), history);
    expect(rec.learningNote).toContain('2 promociones anteriores');
    expect(rec.confidence).toBeGreaterThan(70);
  });
});

describe('texto de las alertas', () => {
  it('pluraliza bien las unidades y dice cuándo vence', () => {
    const input = { ...base, expiryDate: inDays(1), quantity: 11, dailySales: 0.5 };
    const copy = buildAlertCopy(input, computeRisk(input), 35);
    expect(copy.title).toContain('11 unidades');
    expect(copy.title).toContain('vencen mañana');
    expect(copy.body).toContain('35 %');
  });
});
