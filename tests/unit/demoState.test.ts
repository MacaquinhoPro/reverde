import { describe, expect, it } from 'vitest';
import { buildSeed, loadDemoState, SEED_VERSION, stampFresh } from '../../src/lib/demoState';
import { daysUntil } from '../../src/lib/format';
import { load, save } from '../../src/lib/storage';
import type { Product } from '../../src/types';
import { makeProduct, makeSale, makeUser, makePromo } from '../helpers/factories';
import { todayKey } from '../helpers/render';

const dayKeyAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayKey(d);
};

describe('buildSeed', () => {
  it('produce un estado inicial completo y sin actividad del usuario', () => {
    const seed = buildSeed();
    expect(seed.products.length).toBeGreaterThan(0);
    expect(seed.sales.length).toBeGreaterThan(0);
    expect(seed.promoOutcomes.length).toBeGreaterThan(0);
    expect(seed.orders).toEqual([]);
    expect(seed.cart).toEqual([]);
    expect(seed.dismissed).toEqual({});
    expect(seed.appliedRecs).toEqual([]);
  });
});

describe('stampFresh', () => {
  it('marca la versión de semilla y el día actual', () => {
    stampFresh();
    expect(load('seedVersion', 0)).toBe(SEED_VERSION);
    expect(load('anchorDay', '')).toBe(todayKey());
  });
});

describe('loadDemoState', () => {
  it('siembra desde cero en la primera visita', () => {
    const state = loadDemoState();
    expect(state.user).toBeNull();
    expect(state.products.length).toBeGreaterThan(0);
    expect(load('seedVersion', 0)).toBe(SEED_VERSION);
    expect(load('anchorDay', '')).toBe(todayKey());
  });

  it('resiembra cuando cambió la versión de las semillas, conservando la sesión', () => {
    save('seedVersion', SEED_VERSION - 1);
    save('anchorDay', todayKey());
    save('user', makeUser());
    save('products', [makeProduct({ name: 'Producto viejo' })]);

    const state = loadDemoState();

    expect(state.user?.email).toBe('supermercado1@reverde.com');
    expect(state.products.length).toBeGreaterThan(1);
    expect(state.products.some((p) => p.name === 'Producto viejo')).toBe(false);
    expect(load('seedVersion', 0)).toBe(SEED_VERSION);
  });

  it('lee el estado guardado sin tocarlo si no cambió el día', () => {
    const mio = makeProduct({ name: 'Mi producto', createdBy: 'user' });
    save('seedVersion', SEED_VERSION);
    save('anchorDay', todayKey());
    save('products', [mio]);
    save('sales', []);
    save('orders', []);
    save('promoOutcomes', []);
    save('cart', [{ productId: mio.id, qty: 2 }]);
    save('dismissed', {});
    save('appliedRecs', []);

    const state = loadDemoState();
    expect(state.products).toEqual([mio]);
    expect(state.cart).toEqual([{ productId: mio.id, qty: 2 }]);
  });

  it('reancla las fechas de las semillas cuando pasaron días', () => {
    const semilla = makeProduct({ createdBy: 'seed', expiryDate: new Date().toISOString() });
    const mio = makeProduct({ createdBy: 'user', expiryDate: new Date().toISOString() });
    const ventaSemilla = makeSale({ seed: true, date: new Date().toISOString() });
    const ventaMia = makeSale({ date: new Date().toISOString() });
    const promoSemilla = makePromo({ seed: true, date: new Date().toISOString() });

    save('seedVersion', SEED_VERSION);
    save('anchorDay', dayKeyAgo(3));
    save('products', [semilla, mio]);
    save('sales', [ventaSemilla, ventaMia]);
    save('promoOutcomes', [promoSemilla]);
    save('orders', []);
    save('cart', []);
    save('dismissed', {});
    save('appliedRecs', []);

    const state = loadDemoState();
    const porId = (id: string) => state.products.find((p) => p.id === id)!;

    // Lo simulado se corre 3 días hacia adelante: "hoy" sigue siendo hoy.
    expect(daysUntil(porId(semilla.id).expiryDate)).toBe(3);
    // Lo que creó la persona conserva su fecha real.
    expect(daysUntil(porId(mio.id).expiryDate)).toBe(0);

    expect(new Date(state.sales.find((s) => s.id === ventaSemilla.id)!.date).getTime())
      .toBeGreaterThan(new Date(ventaSemilla.date).getTime());
    expect(state.sales.find((s) => s.id === ventaMia.id)!.date).toBe(ventaMia.date);
    expect(new Date(state.promoOutcomes[0].date).getTime())
      .toBeGreaterThan(new Date(promoSemilla.date).getTime());

    // El reanclaje se persiste y el día queda actualizado.
    expect(load('anchorDay', '')).toBe(todayKey());
    expect(daysUntil(load<Product[]>('products', [])[0].expiryDate)).toBe(3);
  });

  it('limpia los silenciamientos vencidos al cambiar de día', () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    const pasado = new Date(Date.now() - 86_400_000).toISOString();

    save('seedVersion', SEED_VERSION);
    save('anchorDay', dayKeyAgo(2));
    save('products', []);
    save('sales', []);
    save('promoOutcomes', []);
    save('orders', []);
    save('cart', []);
    save('dismissed', { 'p-vigente': futuro, 'p-vencido': pasado });
    save('appliedRecs', []);

    const state = loadDemoState();
    expect(Object.keys(state.dismissed)).toEqual(['p-vigente']);
  });

  it('no reancla hacia atrás si el reloj del equipo va atrasado', () => {
    const semilla = makeProduct({ createdBy: 'seed' });
    save('seedVersion', SEED_VERSION);
    save('anchorDay', todayKey(new Date(Date.now() + 5 * 86_400_000)));
    save('products', [semilla]);
    save('sales', []);
    save('promoOutcomes', []);
    save('orders', []);
    save('cart', []);
    save('dismissed', {});
    save('appliedRecs', []);

    const state = loadDemoState();
    expect(state.products[0].expiryDate).toBe(semilla.expiryDate);
  });

  it('tolera un anchorDay corrupto', () => {
    const semilla = makeProduct({ createdBy: 'seed' });
    save('seedVersion', SEED_VERSION);
    save('anchorDay', 'no-es-una-fecha');
    save('products', [semilla]);
    save('sales', []);
    save('promoOutcomes', []);
    save('orders', []);
    save('cart', []);
    save('dismissed', {});
    save('appliedRecs', []);

    expect(() => loadDemoState()).not.toThrow();
    expect(loadDemoState().products[0].expiryDate).toBe(semilla.expiryDate);
  });
});
