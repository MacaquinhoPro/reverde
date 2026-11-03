import { describe, expect, it } from 'vitest';
import {
  aggregate,
  clientMetrics,
  co2FromKg,
  inventoryStats,
  monthOverMonth,
  riskByCategory,
  salesInLastDays,
  salesOf,
  waterFromKg,
  weeklySeries,
} from '../../src/lib/metrics';
import { computeRisk, finalPrice } from '../../src/lib/ai';
import { addDays } from '../../src/lib/format';
import { makeOrder, makeOrderItem, makeProduct, makeSale } from '../helpers/factories';

describe('aggregate', () => {
  it('suma unidades, kilos, dinero y canal', () => {
    const m = aggregate([
      makeSale({ qty: 2, wasteAvoidedKg: 0.5, recovered: 6000, originalPrice: 5000, channel: 'marketplace' }),
      makeSale({ qty: 3, wasteAvoidedKg: 1.5, recovered: 9000, originalPrice: 4000, channel: 'tienda' }),
    ]);
    expect(m.rescued).toBe(5);
    expect(m.wasteAvoidedKg).toBeCloseTo(2, 5);
    expect(m.recovered).toBe(15_000);
    expect(m.lossesAvoided).toBe(5000 * 2 + 4000 * 3);
    expect(m.marketplaceSales).toBe(1);
    expect(m.orders).toBe(2);
  });

  it('la tasa de recuperación es recuperado sobre valor original', () => {
    const m = aggregate([makeSale({ qty: 1, originalPrice: 10_000, recovered: 6000 })]);
    expect(m.recoveryRate).toBeCloseTo(60, 5);
  });

  it('sin ventas devuelve ceros y no divide por cero', () => {
    const m = aggregate([]);
    expect(m).toEqual({
      rescued: 0,
      wasteAvoidedKg: 0,
      recovered: 0,
      lossesAvoided: 0,
      recoveryRate: 0,
      marketplaceSales: 0,
      orders: 0,
    });
  });

  it('una donación (recuperado 0) no rompe la tasa', () => {
    const m = aggregate([makeSale({ qty: 4, originalPrice: 5000, recovered: 0 })]);
    expect(m.recoveryRate).toBe(0);
    expect(m.rescued).toBe(4);
  });
});

describe('salesOf / salesInLastDays', () => {
  const ventas = [
    makeSale({ establishmentId: 'sup-1', date: addDays(-2) }),
    makeSale({ establishmentId: 'sup-2', date: addDays(-2) }),
    makeSale({ establishmentId: 'sup-1', date: addDays(-45) }),
  ];

  it('filtra por establecimiento y devuelve todo si no se pasa ninguno', () => {
    expect(salesOf(ventas, 'sup-1')).toHaveLength(2);
    expect(salesOf(ventas, 'res-9')).toHaveLength(0);
    expect(salesOf(ventas)).toHaveLength(3);
  });

  it('filtra por ventana temporal', () => {
    expect(salesInLastDays(ventas, 7)).toHaveLength(2);
    expect(salesInLastDays(ventas, 60)).toHaveLength(3);
    expect(salesInLastDays(ventas, 1)).toHaveLength(0);
  });
});

describe('monthOverMonth', () => {
  it('compara los últimos 30 días contra los 30 anteriores', () => {
    const mom = monthOverMonth([
      makeSale({ date: addDays(-5), qty: 10, recovered: 20_000, wasteAvoidedKg: 5, originalPrice: 5000 }),
      makeSale({ date: addDays(-45), qty: 5, recovered: 10_000, wasteAvoidedKg: 2.5, originalPrice: 5000 }),
    ]);
    expect(mom.current.rescued).toBe(10);
    expect(mom.previous.rescued).toBe(5);
    expect(mom.rescuedDelta).toBeCloseTo(100, 5);
    expect(mom.recoveredDelta).toBeCloseTo(100, 5);
    expect(mom.wasteDelta).toBeCloseTo(100, 5);
    expect(mom.extraRecovered).toBe(10_000);
  });

  it('sin mes anterior reporta +100 % si hubo actividad y 0 % si no', () => {
    const conActividad = monthOverMonth([makeSale({ date: addDays(-3), qty: 4 })]);
    expect(conActividad.rescuedDelta).toBe(100);
    expect(monthOverMonth([]).rescuedDelta).toBe(0);
  });

  it('una caída se refleja como variación negativa', () => {
    const mom = monthOverMonth([
      makeSale({ date: addDays(-5), qty: 2 }),
      makeSale({ date: addDays(-40), qty: 8 }),
    ]);
    expect(mom.rescuedDelta).toBeCloseTo(-75, 5);
  });

  it('ignora lo anterior a 60 días', () => {
    const mom = monthOverMonth([makeSale({ date: addDays(-90), qty: 50 })]);
    expect(mom.current.rescued).toBe(0);
    expect(mom.previous.rescued).toBe(0);
  });
});

describe('weeklySeries', () => {
  it('devuelve 8 semanas, la última etiquetada como la actual', () => {
    const serie = weeklySeries([]);
    expect(serie).toHaveLength(8);
    expect(serie[0]).toMatchObject({ label: 'S1', weeksAgo: 7 });
    expect(serie[7]).toMatchObject({ label: 'Esta sem.', weeksAgo: 0 });
  });

  it('asigna cada venta a su semana y acumula el canal marketplace', () => {
    const serie = weeklySeries([
      makeSale({ date: addDays(-1), qty: 2, wasteAvoidedKg: 1.25, recovered: 5000, channel: 'marketplace' }),
      makeSale({ date: addDays(-10), qty: 3, wasteAvoidedKg: 2, recovered: 7000, channel: 'tienda' }),
    ]);
    const actual = serie.find((b) => b.weeksAgo === 0)!;
    const haceUna = serie.find((b) => b.weeksAgo === 1)!;
    expect(actual).toMatchObject({ rescued: 2, recovered: 5000, marketplace: 2, wasteAvoidedKg: 1.3 });
    expect(haceUna).toMatchObject({ rescued: 3, recovered: 7000, marketplace: 0, wasteAvoidedKg: 2 });
  });

  it('descarta las ventas fuera de la ventana pedida', () => {
    const serie = weeklySeries([makeSale({ date: addDays(-60), qty: 99 })]);
    expect(serie.reduce((s, b) => s + b.rescued, 0)).toBe(0);
  });

  it('acepta una ventana personalizada', () => {
    const serie = weeklySeries([], 4);
    expect(serie).toHaveLength(4);
    expect(serie[3].label).toBe('Esta sem.');
  });
});

describe('inventoryStats', () => {
  it('clasifica el inventario por nivel de riesgo', () => {
    const alto = makeProduct({ expiryDate: addDays(0), quantity: 40, dailySales: 1, originalPrice: 5000 });
    const medio = makeProduct({ expiryDate: addDays(6), quantity: 20, dailySales: 3 });
    const bajo = makeProduct({ expiryDate: addDays(20), quantity: 5, dailySales: 10 });

    expect(computeRisk(alto).level).toBe('alto');
    expect(computeRisk(medio).level).toBe('medio');
    expect(computeRisk(bajo).level).toBe('bajo');

    const stats = inventoryStats([alto, medio, bajo]);
    expect(stats).toMatchObject({ total: 3, high: 1, medium: 1, low: 1, units: 65 });
  });

  it('el valor en riesgo pondera el riesgo medio al 40 %', () => {
    const alto = makeProduct({ expiryDate: addDays(0), quantity: 10, dailySales: 1, originalPrice: 5000, discountPercent: 0 });
    const medio = makeProduct({ expiryDate: addDays(6), quantity: 20, dailySales: 3, originalPrice: 5000 });
    const stats = inventoryStats([alto, medio]);
    expect(stats.valueAtRisk).toBeCloseTo(
      finalPrice(alto) * 10 + finalPrice(medio) * 20 * 0.4,
      5,
    );
  });

  it('cuenta lo que vence en 3 días o menos, incluido lo vencido', () => {
    const stats = inventoryStats([
      makeProduct({ expiryDate: addDays(-1) }),
      makeProduct({ expiryDate: addDays(3) }),
      makeProduct({ expiryDate: addDays(4) }),
    ]);
    expect(stats.expiringSoon).toBe(2);
  });

  it('cuenta las publicaciones activas y el valor total del inventario', () => {
    const a = makeProduct({ status: 'publicado', quantity: 4, originalPrice: 5000, discountPercent: 20 });
    const b = makeProduct({ status: 'en_inventario', quantity: 2, originalPrice: 10_000 });
    const stats = inventoryStats([a, b]);
    expect(stats.published).toBe(1);
    expect(stats.inventoryValue).toBe(finalPrice(a) * 4 + finalPrice(b) * 2);
  });

  it('un inventario vacío devuelve ceros', () => {
    expect(inventoryStats([])).toEqual({
      total: 0, units: 0, high: 0, medium: 0, low: 0,
      expiringSoon: 0, published: 0, inventoryValue: 0, valueAtRisk: 0,
    });
  });
});

describe('riskByCategory', () => {
  it('promedia el score por categoría y ordena de mayor a menor', () => {
    const filas = riskByCategory([
      makeProduct({ category: 'Preparados', expiryDate: addDays(0), quantity: 30, dailySales: 1 }),
      makeProduct({ category: 'Bebidas', expiryDate: addDays(25), quantity: 5, dailySales: 10 }),
      makeProduct({ category: 'Bebidas', expiryDate: addDays(30), quantity: 5, dailySales: 10 }),
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0].category).toBe('Preparados');
    expect(filas[0].items).toBe(1);
    expect(filas[1].items).toBe(2);
    expect(filas[0].score).toBeGreaterThan(filas[1].score);
  });

  it('solo acumula kilos de los productos en riesgo medio o alto', () => {
    const filas = riskByCategory([
      makeProduct({ category: 'Carnes', expiryDate: addDays(0), quantity: 10, weightPerUnitKg: 0.5, dailySales: 1 }),
      makeProduct({ category: 'Bebidas', expiryDate: addDays(30), quantity: 10, weightPerUnitKg: 1, dailySales: 10 }),
    ]);
    expect(filas.find((f) => f.category === 'Carnes')!.kg).toBeCloseTo(5, 5);
    expect(filas.find((f) => f.category === 'Bebidas')!.kg).toBe(0);
  });

  it('un inventario vacío no produce filas', () => {
    expect(riskByCategory([])).toEqual([]);
  });
});

describe('clientMetrics', () => {
  it('solo cuenta los pedidos del usuario indicado', () => {
    const pedidos = [
      makeOrder({ userId: 'u-cli-1', savings: 5000, total: 12_000, wasteAvoidedKg: 1.2, items: [makeOrderItem({ qty: 3 })] }),
      makeOrder({ userId: 'u-cli-1', mode: 'reserva', savings: 2000, total: 8000, wasteAvoidedKg: 0.8, items: [makeOrderItem({ qty: 1 })] }),
      makeOrder({ userId: 'u-cli-2', savings: 9999, total: 9999, wasteAvoidedKg: 9, items: [makeOrderItem({ qty: 9 })] }),
    ];
    const m = clientMetrics(pedidos, 'u-cli-1');
    expect(m).toEqual({
      orders: 2,
      reservations: 1,
      saved: 7000,
      rescued: 4,
      wasteAvoidedKg: 2,
      spent: 20_000,
    });
  });

  it('un usuario sin pedidos obtiene ceros', () => {
    expect(clientMetrics([], 'u-cli-9')).toEqual({
      orders: 0, reservations: 0, saved: 0, rescued: 0, wasteAvoidedKg: 0, spent: 0,
    });
  });
});

describe('equivalencias ambientales', () => {
  it('2,5 kg de CO₂e por kg de comida rescatada', () => {
    expect(co2FromKg(10)).toBe(25);
    expect(co2FromKg(0)).toBe(0);
    expect(co2FromKg(1.11)).toBe(2.8);
  });

  it('1.000 litros de agua por kg de comida rescatada', () => {
    expect(waterFromKg(2.5)).toBe(2500);
    expect(waterFromKg(0)).toBe(0);
    expect(waterFromKg(0.1234)).toBe(123);
  });
});
