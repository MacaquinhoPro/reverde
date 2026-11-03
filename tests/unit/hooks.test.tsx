import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEstablishmentData } from '../../src/hooks/useEstablishmentData';
import { useMarketplaceProducts, type MarketplaceFilters } from '../../src/hooks/useMarketplace';
import { addDays } from '../../src/lib/format';
import { makeProduct, makePromo, makeSale, makeUser } from '../helpers/factories';
import { renderHookWithApp } from '../helpers/render';

/* ── useMarketplaceProducts ─────────────────────────────────────────────── */

const pub = (patch = {}) => makeProduct({ status: 'publicado', quantity: 10, ...patch });

const marketplace = (filters: MarketplaceFilters, products = pub()) =>
  renderHookWithApp(() => useMarketplaceProducts(filters), {
    products: Array.isArray(products) ? products : [products],
  });

describe('useMarketplaceProducts', () => {
  it('solo muestra lo publicado y con stock', () => {
    const visible = pub({ name: 'Visible' });
    const { result } = marketplace({}, [
      visible,
      pub({ name: 'Sin stock', quantity: 0 }),
      makeProduct({ name: 'En inventario', status: 'en_inventario' }),
      makeProduct({ name: 'Donado', status: 'donado' }),
    ] as never);
    expect(result().map((p) => p.name)).toEqual(['Visible']);
  });

  it('busca por nombre, categoría y nombre del establecimiento', () => {
    const lista = [
      pub({ name: 'Yogur griego', category: 'Lácteos', establishmentId: 'sup-1' }),
      pub({ name: 'Croissant', category: 'Panadería', establishmentId: 'res-2' }),
    ] as never;
    expect(marketplace({ query: 'yogur' }, lista).result()).toHaveLength(1);
    expect(marketplace({ query: 'PANADERÍA' }, lista).result()[0].name).toBe('Croissant');
    expect(marketplace({ query: 'trigal' }, lista).result()[0].name).toBe('Croissant');
    expect(marketplace({ query: '   ' }, lista).result()).toHaveLength(2);
    expect(marketplace({ query: 'nada-de-esto' }, lista).result()).toHaveLength(0);
  });

  it('filtra por categoría, establecimiento y tipo de establecimiento', () => {
    const lista = [
      pub({ name: 'Lácteo super', category: 'Lácteos', establishmentId: 'sup-1' }),
      pub({ name: 'Pan resto', category: 'Panadería', establishmentId: 'res-2' }),
    ] as never;
    expect(marketplace({ category: 'Lácteos' }, lista).result()[0].name).toBe('Lácteo super');
    expect(marketplace({ category: 'todas' }, lista).result()).toHaveLength(2);
    expect(marketplace({ establishmentId: 'res-2' }, lista).result()[0].name).toBe('Pan resto');
    expect(marketplace({ establishmentType: 'restaurante' }, lista).result()[0].name).toBe('Pan resto');
    expect(marketplace({ establishmentType: 'todos' }, lista).result()).toHaveLength(2);
  });

  it('filtra por distancia, precio y descuento mínimo', () => {
    const lista = [
      pub({ name: 'Cerca', establishmentId: 'res-1', originalPrice: 10_000, discountPercent: 50 }), // 0,8 km
      pub({ name: 'Lejos', establishmentId: 'sup-3', originalPrice: 2000, discountPercent: 0 }),   // 3,4 km
    ] as never;
    expect(marketplace({ maxDistance: 1 }, lista).result().map((p) => p.name)).toEqual(['Cerca']);
    expect(marketplace({ maxPrice: 3000 }, lista).result().map((p) => p.name)).toEqual(['Lejos']);
    expect(marketplace({ minDiscount: 40 }, lista).result().map((p) => p.name)).toEqual(['Cerca']);
  });

  it('"vence pronto" deja solo lo de 2 días o menos', () => {
    const lista = [
      pub({ name: 'Hoy', expiryDate: addDays(0) }),
      pub({ name: 'En dos días', expiryDate: addDays(2) }),
      pub({ name: 'En cinco días', expiryDate: addDays(5) }),
    ] as never;
    expect(marketplace({ expiringSoon: true }, lista).result().map((p) => p.name).sort())
      .toEqual(['En dos días', 'Hoy']);
  });

  it('ordena por descuento, precio, distancia y vencimiento', () => {
    const lista = [
      pub({ name: 'A', establishmentId: 'sup-3', originalPrice: 10_000, discountPercent: 10, expiryDate: addDays(9) }),
      pub({ name: 'B', establishmentId: 'res-1', originalPrice: 20_000, discountPercent: 50, expiryDate: addDays(1) }),
    ] as never;
    expect(marketplace({ sort: 'descuento' }, lista).result().map((p) => p.name)).toEqual(['B', 'A']);
    // A: 10.000 −10 % = 9.000 · B: 20.000 −50 % = 10.000
    expect(marketplace({ sort: 'precio' }, lista).result().map((p) => p.name)).toEqual(['A', 'B']);
    expect(marketplace({ sort: 'distancia' }, lista).result().map((p) => p.name)).toEqual(['B', 'A']);
    expect(marketplace({ sort: 'vencimiento' }, lista).result().map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('por relevancia, los destacados van primero y luego los de más riesgo', () => {
    const lista = [
      pub({ name: 'Riesgoso', expiryDate: addDays(0), dailySales: 0.5, quantity: 40 }),
      pub({ name: 'Tranquilo', expiryDate: addDays(25), dailySales: 10, quantity: 3 }),
      pub({ name: 'Destacado', featured: true, expiryDate: addDays(25), dailySales: 10, quantity: 3 }),
    ] as never;
    expect(marketplace({}, lista).result().map((p) => p.name)).toEqual(['Destacado', 'Riesgoso', 'Tranquilo']);
  });

  it('no muta el arreglo de productos del store al ordenar', () => {
    const lista = [pub({ name: 'A', discountPercent: 10 }), pub({ name: 'B', discountPercent: 50 })] as never;
    const { result, api } = renderHookWithApp(() => useMarketplaceProducts({ sort: 'descuento' }), { products: lista });
    expect(result().map((p) => p.name)).toEqual(['B', 'A']);
    expect(api().products.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('reacciona cuando el administrador publica algo nuevo', () => {
    const oculto = makeProduct({ name: 'Recién publicado', status: 'en_inventario' });
    const { result, api } = renderHookWithApp(() => useMarketplaceProducts({}), { products: [oculto] });
    expect(result()).toHaveLength(0);
    act(() => api().setPublished(oculto.id, true));
    expect(result().map((p) => p.name)).toEqual(['Recién publicado']);
  });
});

/* ── useEstablishmentData ───────────────────────────────────────────────── */

describe('useEstablishmentData', () => {
  const laura = makeUser();

  it('aísla el inventario y las ventas del establecimiento de la sesión', () => {
    const mio = makeProduct({ establishmentId: 'sup-1', name: 'Mío' });
    const ajeno = makeProduct({ establishmentId: 'res-2', name: 'Ajeno' });
    const { result } = renderHookWithApp(() => useEstablishmentData(), {
      user: laura,
      products: [mio, ajeno],
      sales: [makeSale({ establishmentId: 'sup-1' }), makeSale({ establishmentId: 'res-2' })],
    });

    expect(result().establishmentId).toBe('sup-1');
    expect(result().establishment?.name).toBe('Supermercado Verde');
    expect(result().myProducts.map((p) => p.name)).toEqual(['Mío']);
    expect(result().mySales).toHaveLength(1);
  });

  it('permite al superadmin mirar otro establecimiento', () => {
    const { result } = renderHookWithApp(() => useEstablishmentData('res-2'), {
      user: makeUser({ role: 'superadmin', establishmentId: undefined }),
      products: [makeProduct({ establishmentId: 'res-2', name: 'Del Trigal' })],
    });
    expect(result().establishment?.name).toBe('Panadería El Trigal');
    expect(result().myProducts.map((p) => p.name)).toEqual(['Del Trigal']);
  });

  it('puntúa y ordena el inventario de mayor a menor riesgo', () => {
    const { result } = renderHookWithApp(() => useEstablishmentData(), {
      user: laura,
      products: [
        makeProduct({ name: 'Tranquilo', expiryDate: addDays(25), dailySales: 10, quantity: 3 }),
        makeProduct({ name: 'Urgente', expiryDate: addDays(0), dailySales: 0.5, quantity: 40 }),
      ],
    });
    const scored = result().scored;
    expect(scored.map((s) => s.product.name)).toEqual(['Urgente', 'Tranquilo']);
    expect(scored[0].risk.level).toBe('alto');
    expect(scored[0].recommendation.productId).toBe(scored[0].product.id);
    expect(scored[0].risk.score).toBeGreaterThan(scored[1].risk.score);
  });

  it('genera alertas solo para riesgo medio y alto con stock', () => {
    const { result } = renderHookWithApp(() => useEstablishmentData(), {
      user: laura,
      products: [
        makeProduct({ name: 'Urgente', expiryDate: addDays(0), dailySales: 0.5, quantity: 40 }),
        makeProduct({ name: 'Medio', expiryDate: addDays(6), quantity: 20, dailySales: 3 }),
        makeProduct({ name: 'Tranquilo', expiryDate: addDays(25), dailySales: 10, quantity: 3 }),
        makeProduct({ name: 'Agotado', expiryDate: addDays(0), dailySales: 0.5, quantity: 0 }),
      ],
    });
    const alerts = result().alerts;
    expect(alerts.map((a) => a.level)).toEqual(['alto', 'medio']);
    expect(alerts[0].id).toMatch(/^a_/);
    expect(alerts[0].establishmentId).toBe('sup-1');
    expect(alerts[0].title.length).toBeGreaterThan(5);
    expect(alerts[0].body.length).toBeGreaterThan(5);
  });

  it('respeta los silenciamientos vigentes y vuelve a avisar cuando expiran', () => {
    const urgente = makeProduct({ name: 'Urgente', expiryDate: addDays(0), dailySales: 0.5, quantity: 40 });
    const vigente = { [urgente.id]: new Date(Date.now() + 3_600_000).toISOString() };
    const expirado = { [urgente.id]: new Date(Date.now() - 3_600_000).toISOString() };

    expect(renderHookWithApp(() => useEstablishmentData(), { user: laura, products: [urgente], dismissed: vigente })
      .result().alerts).toHaveLength(0);
    expect(renderHookWithApp(() => useEstablishmentData(), { user: laura, products: [urgente], dismissed: expirado })
      .result().alerts).toHaveLength(1);
  });

  it('la recomendación usa el histórico de promociones del store', () => {
    const p = makeProduct({ expiryDate: addDays(1), quantity: 40, dailySales: 1 });
    const { result } = renderHookWithApp(() => useEstablishmentData(), {
      user: laura,
      products: [p],
      promoOutcomes: [makePromo({ category: 'Lácteos', discountPercent: 30, sellThrough: 88, daysToSell: 2 })],
    });
    expect(result().scored[0].recommendation.learningNote).toContain('88 %');
  });

  it('sin establecimiento asignado (cliente) no hay inventario ni alertas', () => {
    const { result } = renderHookWithApp(() => useEstablishmentData(), {
      user: makeUser({ role: 'cliente', establishmentId: undefined }),
      products: [makeProduct({ establishmentId: 'sup-1' })],
    });
    expect(result().establishment).toBeUndefined();
    expect(result().myProducts).toEqual([]);
    expect(result().alerts).toEqual([]);
  });

  it('las alertas desaparecen al aplicar el descuento recomendado', () => {
    const p = makeProduct({ expiryDate: addDays(6), quantity: 20, dailySales: 3 });
    const { result, api } = renderHookWithApp(() => useEstablishmentData(), { user: laura, products: [p] });
    expect(result().alerts).toHaveLength(1);
    act(() => api().applyDiscount(p.id, 80));
    expect(result().alerts).toHaveLength(0);
  });
});
