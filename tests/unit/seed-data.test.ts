import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/data/catalog';
import { ESTABLISHMENTS, byEstablishment } from '../../src/data/establishments';
import { buildSeedPromoOutcomes, buildSeedSales } from '../../src/data/history';
import { buildSeedProducts } from '../../src/data/products';
import { DEMO_PASSWORD, QUICK_ACCESS, USERS, findUserByEmail } from '../../src/data/users';
import { daysUntil } from '../../src/lib/format';
import type { Category, Unit } from '../../src/types';

const CATEGORIES: Category[] = [
  'Lácteos', 'Frutas y verduras', 'Panadería', 'Preparados', 'Carnes', 'Cajas de rescate', 'Bebidas',
];
const UNITS: Unit[] = ['unidad', 'kg', 'g', 'litro', 'bandeja', 'caja'];

describe('catálogo', () => {
  const items = Object.entries(CATALOG);

  it('cada entrada usa su propia clave', () => {
    for (const [key, item] of items) expect(item.key).toBe(key);
  });

  it('cada artículo tiene categoría, unidad, peso y precio válidos', () => {
    for (const [, item] of items) {
      expect(CATEGORIES).toContain(item.category);
      expect(UNITS).toContain(item.unit);
      expect(item.weightPerUnitKg).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(0);
      expect(item.price % 50).toBe(0);
      expect(item.description.length).toBeGreaterThan(20);
      expect(item.emoji.length).toBeGreaterThan(0);
      expect(item.photo).toMatch(/^\/img\/productos\/.+\.(jpg|jpeg|png|webp)$/);
    }
  });
});

describe('establecimientos', () => {
  it('los ids son únicos', () => {
    expect(new Set(ESTABLISHMENTS.map((e) => e.id)).size).toBe(ESTABLISHMENTS.length);
  });

  it('las coordenadas del mapa simulado están en rango', () => {
    for (const e of ESTABLISHMENTS) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(100);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(100);
      expect(e.distanceKm).toBeGreaterThan(0);
      expect(e.rating).toBeGreaterThanOrEqual(0);
      expect(e.rating).toBeLessThanOrEqual(5);
      expect(Number.isNaN(new Date(e.joinedAt).getTime())).toBe(false);
    }
  });

  it('byEstablishment resuelve por id y tolera undefined', () => {
    expect(byEstablishment('sup-1')?.name).toBe('Supermercado Verde');
    expect(byEstablishment('no-existe')).toBeUndefined();
    expect(byEstablishment(undefined)).toBeUndefined();
  });
});

describe('cuentas demo', () => {
  it('los correos e ids son únicos', () => {
    expect(new Set(USERS.map((u) => u.email)).size).toBe(USERS.length);
    expect(new Set(USERS.map((u) => u.id)).size).toBe(USERS.length);
  });

  it('los administradores apuntan a un establecimiento existente', () => {
    for (const u of USERS) {
      if (u.role === 'supermercado' || u.role === 'restaurante') {
        expect(u.establishmentId).toBeDefined();
        expect(byEstablishment(u.establishmentId)).toBeDefined();
      } else {
        expect(u.establishmentId).toBeUndefined();
      }
    }
  });

  it('el rol del administrador coincide con el tipo de su establecimiento', () => {
    for (const u of USERS) {
      if (u.role === 'supermercado' || u.role === 'restaurante') {
        expect(byEstablishment(u.establishmentId)!.type).toBe(u.role);
      }
    }
  });

  it('findUserByEmail ignora mayúsculas y espacios', () => {
    expect(findUserByEmail('  SuperMercado1@Reverde.com ')?.id).toBe('u-sup-1');
    expect(findUserByEmail('nadie@reverde.com')).toBeUndefined();
  });

  it('los accesos rápidos apuntan a cuentas reales con el rol anunciado', () => {
    for (const q of QUICK_ACCESS) {
      const user = findUserByEmail(q.email);
      expect(user, q.email).toBeDefined();
      expect(user!.role).toBe(q.role);
    }
  });

  it('la contraseña de la demo es la documentada', () => {
    expect(DEMO_PASSWORD).toBe('Demo1234');
  });
});

describe('inventario semilla', () => {
  const products = buildSeedProducts();

  it('genera inventario para los seis establecimientos', () => {
    expect(products.length).toBeGreaterThan(40);
    expect(new Set(products.map((p) => p.establishmentId)).size).toBe(ESTABLISHMENTS.length);
  });

  it('los ids son únicos', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it('cada producto es coherente', () => {
    for (const p of products) {
      expect(byEstablishment(p.establishmentId), p.id).toBeDefined();
      expect(CATEGORIES).toContain(p.category);
      expect(UNITS).toContain(p.unit);
      expect(p.quantity).toBeGreaterThan(0);
      expect(p.originalPrice).toBeGreaterThan(0);
      expect(p.discountPercent).toBeGreaterThanOrEqual(0);
      expect(p.discountPercent).toBeLessThanOrEqual(80);
      expect(p.dailySales).toBeGreaterThan(0);
      expect(p.demandTrend).toBeGreaterThanOrEqual(-1);
      expect(p.demandTrend).toBeLessThanOrEqual(1);
      expect(p.createdBy).toBe('seed');
      expect(new Date(p.entryDate).getTime()).toBeLessThan(new Date(p.expiryDate).getTime());
    }
  });

  it('nada nace vencido: la demo debe abrir con inventario vigente', () => {
    for (const p of products) expect(daysUntil(p.expiryDate), p.id).toBeGreaterThanOrEqual(0);
  });

  it('hay productos publicados para que el marketplace nunca abra vacío', () => {
    expect(products.filter((p) => p.status === 'publicado' && p.quantity > 0).length).toBeGreaterThan(10);
  });

  it('la demo arranca con casos de alto riesgo para la sustentación', () => {
    const urgentes = products.filter((p) => daysUntil(p.expiryDate) <= 2);
    expect(urgentes.length).toBeGreaterThan(5);
  });
});

describe('histórico semilla', () => {
  it('las ventas cubren los últimos 60 días y están ordenadas de más reciente a más antigua', () => {
    const sales = buildSeedSales();
    expect(sales.length).toBeGreaterThan(100);
    for (let i = 1; i < sales.length; i++) {
      expect(new Date(sales[i - 1].date).getTime()).toBeGreaterThanOrEqual(new Date(sales[i].date).getTime());
    }
    const edades = sales.map((s) => (Date.now() - new Date(s.date).getTime()) / 86_400_000);
    expect(Math.max(...edades)).toBeLessThan(61);
    // Las ventas del día se reparten en horario comercial (9:00–19:00), así que
    // las de hoy pueden llevar una hora posterior a la actual; lo que no debe
    // pasar nunca es que una venta quede fechada después de hoy.
    const finDeHoy = new Date();
    finDeHoy.setHours(23, 59, 59, 999);
    for (const s of sales) {
      expect(new Date(s.date).getTime(), s.date).toBeLessThanOrEqual(finDeHoy.getTime());
    }
  });

  it('cada venta es consistente y está marcada como semilla', () => {
    for (const s of buildSeedSales()) {
      expect(s.seed).toBe(true);
      expect(byEstablishment(s.establishmentId)).toBeDefined();
      expect(s.qty).toBeGreaterThan(0);
      expect(s.soldPrice).toBeLessThanOrEqual(s.originalPrice);
      expect(s.recovered).toBe(s.soldPrice * s.qty);
      expect(s.wasteAvoidedKg).toBeGreaterThan(0);
      expect(['marketplace', 'tienda']).toContain(s.channel);
    }
  });

  it('el generador es determinista: las cifras de la demo no cambian entre recargas', () => {
    // Los ids llevan un sufijo aleatorio: se comparan los datos, no los ids.
    const limpiar = (s: ReturnType<typeof buildSeedSales>) =>
      s.map((venta) => ({ ...venta, id: '', date: venta.date.slice(0, 10) }));
    expect(limpiar(buildSeedSales())).toEqual(limpiar(buildSeedSales()));
  });

  it('las promociones pasadas cubren todas las categorías con datos plausibles', () => {
    const outcomes = buildSeedPromoOutcomes();
    expect(new Set(outcomes.map((o) => o.category)).size).toBe(CATEGORIES.length);
    for (const o of outcomes) {
      expect(o.seed).toBe(true);
      expect(o.discountPercent).toBeGreaterThan(0);
      expect(o.discountPercent).toBeLessThanOrEqual(80);
      expect(o.sellThrough).toBeGreaterThan(0);
      expect(o.sellThrough).toBeLessThanOrEqual(100);
      expect(o.daysToSell).toBeGreaterThan(0);
      expect(byEstablishment(o.establishmentId)).toBeDefined();
      expect(daysUntil(o.date)).toBeLessThan(0);
    }
  });
});
