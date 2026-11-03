import { describe, expect, it, vi } from 'vitest';
import {
  addDays,
  cop,
  copCompact,
  cx,
  daysUntil,
  expiryLabel,
  formatDate,
  formatDateShort,
  formatDateTime,
  initials,
  kg,
  orderCode,
  pct,
  qtyLabel,
  relativeTime,
  startOfToday,
  uid,
  unitLabel,
} from '../../src/lib/format';

describe('cop / copCompact', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(cop(4500)).toBe('$4.500');
    expect(cop(0)).toBe('$0');
    expect(cop(1234567)).toBe('$1.234.567');
  });

  it('redondea antes de formatear', () => {
    expect(cop(4500.4)).toBe('$4.500');
    expect(cop(4500.6)).toBe('$4.501');
  });

  it('formatea negativos (devoluciones) sin romperse', () => {
    expect(cop(-1500)).toBe('$-1.500');
  });

  it('comprime millones y miles para los KPIs', () => {
    expect(copCompact(1_840_000)).toBe('$1,84 M');
    expect(copCompact(12_500)).toBe('$13k');
    expect(copCompact(950)).toBe('$950');
  });

  it('usa el valor absoluto para decidir la escala', () => {
    expect(copCompact(-2_000_000)).toBe('$-2,00 M');
  });
});

describe('kg / pct', () => {
  it('siempre muestra un decimal', () => {
    expect(kg(86.4)).toBe('86,4 kg');
    expect(kg(5)).toBe('5,0 kg');
    expect(kg(1234.56)).toBe('1.234,6 kg');
  });

  it('redondea los porcentajes al entero', () => {
    expect(pct(76.4)).toBe('76 %');
    expect(pct(76.5)).toBe('77 %');
  });
});

describe('fechas', () => {
  it('formatea en español', () => {
    expect(formatDate('2026-03-09T12:00:00')).toBe('9 de marzo');
    expect(formatDateShort('2026-03-09T12:00:00')).toBe('9 mar');
    expect(formatDateTime('2026-03-09T08:05:00')).toBe('9 mar · 08:05');
  });

  it('startOfToday deja la hora en cero', () => {
    const d = startOfToday();
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });

  it('daysUntil cuenta días calendario, no horas', () => {
    expect(daysUntil(addDays(0))).toBe(0);
    expect(daysUntil(addDays(1))).toBe(1);
    expect(daysUntil(addDays(-2))).toBe(-2);
  });

  it('daysUntil ignora la hora del día', () => {
    const hoyMuyTarde = new Date();
    hoyMuyTarde.setHours(23, 59, 0, 0);
    expect(daysUntil(hoyMuyTarde.toISOString())).toBe(0);
  });

  it('addDays ancla a mediodía para evitar saltos por zona horaria', () => {
    expect(new Date(addDays(3)).getHours()).toBe(12);
  });

  it('expiryLabel describe el vencimiento en lenguaje natural', () => {
    expect(expiryLabel(addDays(-1))).toBe('Vencido');
    expect(expiryLabel(addDays(0))).toBe('Vence hoy');
    expect(expiryLabel(addDays(1))).toBe('Vence mañana');
    expect(expiryLabel(addDays(4))).toBe('Vence en 4 días');
  });

  it('relativeTime cubre minutos, horas y días', () => {
    const base = new Date('2026-05-10T12:00:00Z');
    vi.setSystemTime(base);
    expect(relativeTime(new Date(base.getTime() - 20_000).toISOString())).toBe('ahora');
    expect(relativeTime(new Date(base.getTime() - 15 * 60_000).toISOString())).toBe('hace 15 min');
    expect(relativeTime(new Date(base.getTime() - 5 * 3_600_000).toISOString())).toBe('hace 5 h');
    expect(relativeTime(new Date(base.getTime() - 26 * 3_600_000).toISOString())).toBe('ayer');
    expect(relativeTime(new Date(base.getTime() - 4 * 86_400_000).toISOString())).toBe('hace 4 días');
    vi.useRealTimers();
  });
});

describe('cx', () => {
  it('descarta valores falsy y une con espacios', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
    expect(cx()).toBe('');
  });
});

describe('uid / orderCode', () => {
  it('uid lleva prefijo y no colisiona en volumen', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uid('p')));
    expect(ids.size).toBe(2000);
    expect([...ids][0]).toMatch(/^p_[a-z0-9]+$/);
  });

  it('orderCode tiene el formato que ve el cliente', () => {
    expect(orderCode()).toMatch(/^RV-[A-Z0-9]{5}$/);
  });
});

describe('initials', () => {
  it('toma como máximo dos iniciales', () => {
    expect(initials('Laura Mendoza')).toBe('LM');
    expect(initials('Ana María Rojas Pérez')).toBe('AM');
    expect(initials('  Equipo   Reverde ')).toBe('ER');
    expect(initials('Reverde')).toBe('R');
  });
});

describe('unitLabel / qtyLabel', () => {
  it('pluraliza en español sin inventar palabras', () => {
    expect(unitLabel('unidad', 11)).toBe('unidades');
    expect(unitLabel('unidad', 1)).toBe('unidad');
    expect(unitLabel('caja', 3)).toBe('cajas');
    expect(unitLabel('kg', 3)).toBe('kg');
    expect(unitLabel('litro', 2)).toBe('litros');
    expect(unitLabel('bandeja', 2)).toBe('bandejas');
  });

  it('cae en un plural razonable para unidades no catalogadas', () => {
    expect(unitLabel('paquete', 2)).toBe('paquetes');
  });

  it('qtyLabel combina cantidad y unidad', () => {
    expect(qtyLabel(11, 'unidad')).toBe('11 unidades');
    expect(qtyLabel(1, 'caja')).toBe('1 caja');
    expect(qtyLabel(0, 'unidad')).toBe('0 unidades');
  });
});
