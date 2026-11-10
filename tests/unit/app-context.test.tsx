import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { computeRisk, finalPrice } from '../../src/lib/ai';
import { addDays, daysUntil } from '../../src/lib/format';
import { load } from '../../src/lib/storage';
import type { Order, Product } from '../../src/types';
import { makeProduct, makeUser } from '../helpers/factories';
import { renderApi } from '../helpers/render';

const cliente = makeUser({ id: 'u-cli-1', email: 'cliente1@reverde.com', name: 'Sofía Herrera', role: 'cliente', establishmentId: undefined });

describe('autenticación simulada', () => {
  it('inicia sesión con una cuenta demo', () => {
    const { api } = renderApi();
    let res: ReturnType<ReturnType<typeof api>['login']>;
    act(() => { res = api().login('supermercado1@reverde.com', 'Demo1234'); });
    expect(res!.ok).toBe(true);
    expect(res!.user?.role).toBe('supermercado');
    expect(api().user?.email).toBe('supermercado1@reverde.com');
  });

  it('rechaza un correo desconocido con un mensaje accionable', () => {
    const { api } = renderApi();
    const res = api().login('nadie@reverde.com', 'Demo1234');
    expect(res).toEqual({ ok: false, error: 'No encontramos una cuenta con ese correo.' });
    expect(api().user).toBeNull();
  });

  it('rechaza la contraseña incorrecta y recuerda cuál es la de la demo', () => {
    const { api } = renderApi();
    const res = api().login('supermercado1@reverde.com', 'incorrecta');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Demo1234');
    expect(api().user).toBeNull();
  });

  it('cerrar sesión vacía el carrito para no filtrarlo a la siguiente persona', () => {
    const p = makeProduct({ status: 'publicado' });
    const { api } = renderApi({ user: cliente, products: [p], cart: [{ productId: p.id, qty: 2 }] });
    expect(api().cartCount).toBe(2);
    act(() => api().logout());
    expect(api().user).toBeNull();
    expect(api().cart).toEqual([]);
  });

  it('persiste la sesión en el almacenamiento', () => {
    const { api } = renderApi();
    act(() => { api().login('admin1@reverde.com', 'Demo1234'); });
    expect(load<{ role: string } | null>('user', null)?.role).toBe('superadmin');
  });
});

describe('inventario', () => {
  it('registra un producto con id propio y lo deja de primero', () => {
    const { api } = renderApi({ products: [makeProduct({ name: 'Anterior' })] });
    const { id: _sinId, ...nuevo } = makeProduct({ name: 'Nuevo', createdBy: 'user' });
    void _sinId;
    let creado: Product;
    act(() => { creado = api().addProduct(nuevo); });
    expect(creado!.id).toMatch(/^p_/);
    expect(api().products[0].name).toBe('Nuevo');
    expect(api().products).toHaveLength(2);
  });

  it('actualiza solo el producto indicado', () => {
    const a = makeProduct({ name: 'A' });
    const b = makeProduct({ name: 'B' });
    const { api } = renderApi({ products: [a, b] });
    act(() => api().updateProduct(a.id, { quantity: 99, featured: true }));
    expect(api().productById(a.id)).toMatchObject({ quantity: 99, featured: true });
    expect(api().productById(b.id)!.quantity).toBe(b.quantity);
  });

  it('eliminar un producto también lo saca del carrito', () => {
    const p = makeProduct({ status: 'publicado' });
    const { api } = renderApi({ products: [p], cart: [{ productId: p.id, qty: 1 }] });
    act(() => api().deleteProduct(p.id));
    expect(api().products).toEqual([]);
    expect(api().cart).toEqual([]);
  });

  it('el descuento queda acotado entre 0 y 80 %', () => {
    const p = makeProduct();
    const { api } = renderApi({ products: [p] });
    act(() => api().applyDiscount(p.id, 150));
    expect(api().productById(p.id)!.discountPercent).toBe(80);
    act(() => api().applyDiscount(p.id, -20));
    expect(api().productById(p.id)!.discountPercent).toBe(0);
    act(() => api().applyDiscount(p.id, 35));
    expect(api().productById(p.id)!.discountPercent).toBe(35);
  });

  it('publicar y despublicar alterna el estado', () => {
    const p = makeProduct({ status: 'en_inventario' });
    const { api } = renderApi({ products: [p] });
    act(() => api().setPublished(p.id, true));
    expect(api().productById(p.id)!.status).toBe('publicado');
    act(() => api().setPublished(p.id, false));
    expect(api().productById(p.id)!.status).toBe('en_inventario');
  });

  it('availableStock descuenta lo ya reservado en el carrito', () => {
    const p = makeProduct({ quantity: 5, status: 'publicado' });
    const { api } = renderApi({ products: [p], cart: [{ productId: p.id, qty: 2 }] });
    expect(api().availableStock(p.id)).toBe(3);
    expect(api().availableStock('no-existe')).toBe(0);
  });

  it('silenciar una alerta la deja fuera hasta el mediodía del día objetivo', () => {
    const p = makeProduct();
    const { api } = renderApi({ products: [p] });
    act(() => api().dismissAlert(p.id, 48));

    // `addDays` ancla a mediodía, así que "48 horas" significa "hasta el
    // mediodía de dentro de dos días": la ventana real varía con la hora del
    // día, pero nunca queda en el pasado.
    const until = new Date(api().dismissed[p.id]);
    expect(until.getTime()).toBeGreaterThan(Date.now());
    expect(until.getHours()).toBe(12);
    expect(daysUntil(until.toISOString())).toBe(2);
  });

  it('por defecto silencia hasta el día siguiente', () => {
    const p = makeProduct();
    const { api } = renderApi({ products: [p] });
    act(() => api().dismissAlert(p.id));
    expect(daysUntil(api().dismissed[p.id])).toBe(1);
  });
});

describe('applyRecommendation', () => {
  const alto = () => makeProduct({ expiryDate: addDays(0), quantity: 30, dailySales: 1, originalPrice: 5000 });

  it('aplica el descuento sugerido', () => {
    const p = alto();
    const { api } = renderApi({ products: [p] });
    let msg = '';
    act(() => { msg = api().applyRecommendation(p.id, 'descuento', 40); });
    expect(api().productById(p.id)!.discountPercent).toBe(40);
    expect(msg).toContain('40 %');
    expect(api().appliedRecs).toContain(p.id);
  });

  it('publica en el marketplace', () => {
    const p = alto();
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'publicar', 30); });
    expect(api().productById(p.id)!.status).toBe('publicado');
  });

  it('el combo destaca, publica y descuenta al menos 15 %', () => {
    const p = alto();
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'combo', 30); });
    expect(api().productById(p.id)).toMatchObject({ discountPercent: 25, featured: true, status: 'publicado' });

    const q = alto();
    const otro = renderApi({ products: [q] });
    act(() => { otro.api().applyRecommendation(q.id, 'combo', 10); });
    expect(otro.api().productById(q.id)!.discountPercent).toBe(15);
  });

  it('la caja de rescate crea una publicación nueva y descuenta el stock de origen', () => {
    const p = makeProduct({ quantity: 30, dailySales: 1, expiryDate: addDays(0), originalPrice: 4500, weightPerUnitKg: 0.2 });
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'caja_rescate', 35); });

    const caja = api().products.find((x) => x.isRescueBox)!;
    expect(caja.name).toContain('Caja de rescate');
    expect(caja.category).toBe('Cajas de rescate');
    expect(caja.unit).toBe('caja');
    expect(caja.status).toBe('publicado');
    expect(caja.quantity).toBe(10);            // 30 / 3
    expect(caja.weightPerUnitKg).toBeCloseTo(0.6, 5);
    expect(caja.originalPrice).toBe(13_500);   // 4500 * 3
    expect(caja.discountPercent).toBe(40);     // mínimo de la caja
    expect(caja.createdBy).toBe('user');
    expect(api().productById(p.id)!.quantity).toBe(0);
  });

  it('la caja de rescate nunca se queda en cero unidades', () => {
    const p = makeProduct({ quantity: 2, dailySales: 1, expiryDate: addDays(0) });
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'caja_rescate', 50); });
    expect(api().products.find((x) => x.isRescueBox)!.quantity).toBe(1);
    expect(api().productById(p.id)!.quantity).toBe(0);
  });

  it('donar registra la venta sin ingreso y deja el producto en cero', () => {
    const p = makeProduct({ quantity: 8, weightPerUnitKg: 0.25, expiryDate: addDays(0), dailySales: 1 });
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'donar', 0); });

    const donacion = api().sales[0];
    expect(donacion).toMatchObject({
      customer: 'Banco de Alimentos',
      qty: 8,
      soldPrice: 0,
      recovered: 0,
      discountPercent: 100,
      channel: 'tienda',
      wasteAvoidedKg: 2,
    });
    expect(api().productById(p.id)).toMatchObject({ quantity: 0, status: 'donado' });
  });

  it('destacar publica y marca como destacado', () => {
    const p = makeProduct();
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'destacar', 0); });
    expect(api().productById(p.id)).toMatchObject({ featured: true, status: 'publicado' });
  });

  it('priorizar venta presencial destaca sin publicar', () => {
    const p = makeProduct({ status: 'en_inventario' });
    const { api } = renderApi({ products: [p] });
    act(() => { api().applyRecommendation(p.id, 'venta_presencial', 0); });
    expect(api().productById(p.id)).toMatchObject({ featured: true, status: 'en_inventario' });
  });

  it('informa cuando el producto ya no existe', () => {
    const { api } = renderApi({ products: [] });
    expect(api().applyRecommendation('p-fantasma', 'descuento', 30)).toBe('Producto no encontrado');
  });
});

describe('carrito', () => {
  const p = () => makeProduct({ quantity: 4, status: 'publicado' });

  it('agrega y acumula sin pasarse del stock', () => {
    const prod = p();
    const { api } = renderApi({ products: [prod] });
    act(() => api().addToCart(prod.id, 2));
    expect(api().cart).toEqual([{ productId: prod.id, qty: 2 }]);
    act(() => api().addToCart(prod.id, 1));
    expect(api().cartCount).toBe(3);
    act(() => api().addToCart(prod.id, 99));
    expect(api().cartCount).toBe(4); // tope: el stock disponible
  });

  it('agrega una unidad por defecto', () => {
    const prod = p();
    const { api } = renderApi({ products: [prod] });
    act(() => api().addToCart(prod.id));
    expect(api().cartCount).toBe(1);
  });

  it('ignora productos que no existen', () => {
    const { api } = renderApi({ products: [] });
    act(() => api().addToCart('p-fantasma', 3));
    expect(api().cart).toEqual([]);
  });

  it('setCartQty acota al stock y elimina la línea en cero', () => {
    const prod = p();
    const { api } = renderApi({ products: [prod], cart: [{ productId: prod.id, qty: 2 }] });
    act(() => api().setCartQty(prod.id, 10));
    expect(api().cartCount).toBe(4);
    act(() => api().setCartQty(prod.id, 0));
    expect(api().cart).toEqual([]);
  });

  it('cantidades negativas también eliminan la línea', () => {
    const prod = p();
    const { api } = renderApi({ products: [prod], cart: [{ productId: prod.id, qty: 2 }] });
    act(() => api().setCartQty(prod.id, -3));
    expect(api().cart).toEqual([]);
  });

  it('quitar y vaciar funcionan por separado', () => {
    const a = p();
    const b = p();
    const { api } = renderApi({ products: [a, b], cart: [{ productId: a.id, qty: 1 }, { productId: b.id, qty: 2 }] });
    act(() => api().removeFromCart(a.id));
    expect(api().cart).toEqual([{ productId: b.id, qty: 2 }]);
    act(() => api().clearCart());
    expect(api().cart).toEqual([]);
  });
});

describe('checkout', () => {
  const publicado = (patch = {}) =>
    makeProduct({ quantity: 10, status: 'publicado', originalPrice: 5900, discountPercent: 35, weightPerUnitKg: 0.25, ...patch });

  it('sin sesión no se puede pagar', () => {
    const prod = publicado();
    const { api } = renderApi({ user: null, products: [prod], cart: [{ productId: prod.id, qty: 1 }] });
    expect(api().checkout('compra', 'tarjeta')).toBeNull();
  });

  it('con el carrito vacío no se genera pedido', () => {
    const { api } = renderApi({ user: cliente, products: [], cart: [] });
    expect(api().checkout('compra', 'tarjeta')).toBeNull();
  });

  it('descarta líneas cuyo producto ya no existe', () => {
    const { api } = renderApi({ user: cliente, products: [], cart: [{ productId: 'p-fantasma', qty: 1 }] });
    expect(api().checkout('compra', 'tarjeta')).toBeNull();
  });

  it('genera el pedido con totales, ahorro e impacto', () => {
    const prod = publicado();
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 2 }] });

    let order: Order | null = null;
    act(() => { order = api().checkout('compra', 'tarjeta'); });

    const precio = finalPrice(prod); // 3850
    expect(order).toMatchObject({
      userId: 'u-cli-1',
      userName: 'Sofía Herrera',
      mode: 'compra',
      payment: 'tarjeta',
      status: 'confirmado',
      total: precio * 2,
      savings: (5900 - precio) * 2,
      wasteAvoidedKg: 0.5,
      establishmentIds: ['sup-1'],
    });
    expect(order!.code).toMatch(/^RV-[A-Z0-9]{5}$/);
    expect(order!.items[0]).toMatchObject({ productId: prod.id, qty: 2, unitPrice: precio, unitOriginalPrice: 5900 });
  });

  it('una reserva queda apartada con su ventana de recogida', () => {
    const prod = publicado();
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 1 }] });
    let order: Order | null = null;
    act(() => { order = api().checkout('reserva', 'establecimiento'); });
    expect(order).toMatchObject({ mode: 'reserva', status: 'reservado', pickupWindow: 'Hoy, 17:00 – 20:00' });
  });

  it('guarda la autorización de datos que el cliente dio al pagar', () => {
    const prod = publicado();
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 1 }] });
    const consent = { version: '1.0', acceptedAt: new Date().toISOString(), purpose: 'Gestionar este pedido' };
    let order: Order | null = null;
    act(() => { order = api().checkout('compra', 'tarjeta', consent); });
    expect(order!.consent).toEqual(consent);
    expect(load<Order[]>('orders', [])[0].consent).toEqual(consent);
  });

  it('descuenta el stock y agota el producto cuando se lleva todo', () => {
    const prod = publicado({ quantity: 3 });
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 3 }] });
    act(() => { api().checkout('compra', 'pse'); });
    expect(api().productById(prod.id)).toMatchObject({ quantity: 0, status: 'agotado' });
  });

  it('conserva el estado publicado si queda stock', () => {
    const prod = publicado({ quantity: 10 });
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 4 }] });
    act(() => { api().checkout('compra', 'pse'); });
    expect(api().productById(prod.id)).toMatchObject({ quantity: 6, status: 'publicado' });
  });

  it('alimenta las métricas del establecimiento con una venta de marketplace', () => {
    const prod = publicado();
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 2 }] });
    act(() => { api().checkout('compra', 'tarjeta'); });

    expect(api().sales).toHaveLength(1);
    expect(api().sales[0]).toMatchObject({
      productId: prod.id,
      customer: 'Sofía Herrera',
      establishmentId: 'sup-1',
      qty: 2,
      channel: 'marketplace',
      recovered: finalPrice(prod) * 2,
      wasteAvoidedKg: 0.5,
    });
  });

  it('aprende del resultado real de cada promoción vendida', () => {
    const conDescuento = publicado({ discountPercent: 35, quantity: 10 });
    const sinDescuento = publicado({ discountPercent: 0, quantity: 10 });
    const { api } = renderApi({
      user: cliente,
      products: [conDescuento, sinDescuento],
      cart: [{ productId: conDescuento.id, qty: 5 }, { productId: sinDescuento.id, qty: 5 }],
    });
    act(() => { api().checkout('compra', 'tarjeta'); });

    // Solo lo que iba con descuento deja aprendizaje.
    expect(api().promoOutcomes).toHaveLength(1);
    expect(api().promoOutcomes[0]).toMatchObject({
      category: 'Lácteos',
      discountPercent: 35,
      establishmentId: 'sup-1',
      sellThrough: 100, // (5/10)*100 + 55 = 105, acotado a 100
    });
    expect(api().promoOutcomes[0].sellThrough).toBeLessThanOrEqual(100);
    expect(api().promoOutcomes[0].daysToSell).toBe(Math.max(1, computeRisk(conDescuento).daysLeft));
  });

  it('un pedido de varios establecimientos los registra todos', () => {
    const a = publicado();
    const b = publicado({ establishmentId: 'res-2' });
    const { api } = renderApi({
      user: cliente,
      products: [a, b],
      cart: [{ productId: a.id, qty: 1 }, { productId: b.id, qty: 1 }],
    });
    let order: Order | null = null;
    act(() => { order = api().checkout('compra', 'tarjeta'); });
    expect(order!.establishmentIds.sort()).toEqual(['res-2', 'sup-1']);
    expect(api().sales).toHaveLength(2);
  });

  it('vacía el carrito y persiste el pedido', () => {
    const prod = publicado();
    const { api } = renderApi({ user: cliente, products: [prod], cart: [{ productId: prod.id, qty: 1 }] });
    act(() => { api().checkout('compra', 'tarjeta'); });
    expect(api().cart).toEqual([]);
    expect(api().orders).toHaveLength(1);
    expect(load<Order[]>('orders', [])).toHaveLength(1);
  });
});

describe('avisos', () => {
  it('un aviso aparece y se retira solo', () => {
    vi.useFakeTimers();
    const { api } = renderApi();
    act(() => api().toast({ title: 'Listo' }));
    expect(api().toasts).toHaveLength(1);
    expect(api().toasts[0].id).toMatch(/^t_/);
    act(() => { vi.advanceTimersByTime(4300); });
    expect(api().toasts).toEqual([]);
    vi.useRealTimers();
  });

  it('se puede cerrar antes de tiempo', () => {
    const { api } = renderApi();
    act(() => api().toast({ title: 'Cerrable' }));
    const id = api().toasts[0].id;
    act(() => api().dismissToast(id));
    expect(api().toasts).toEqual([]);
  });
});

describe('resetDemo', () => {
  it('restaura los datos originales y cierra la sesión', () => {
    const { api } = renderApi({
      user: cliente,
      products: [makeProduct({ name: 'Mío' })],
      cart: [],
      dismissed: { 'p-1': addDays(1) },
      appliedRecs: ['p-1'],
    });

    act(() => api().resetDemo());

    expect(api().user).toBeNull();
    expect(api().orders).toEqual([]);
    expect(api().dismissed).toEqual({});
    expect(api().appliedRecs).toEqual([]);
    expect(api().products.some((p) => p.name === 'Mío')).toBe(false);
    expect(api().products.length).toBeGreaterThan(40);
    expect(api().sales.length).toBeGreaterThan(100);
    expect(api().toasts[0].title).toBe('Demo reiniciada');
  });
});

describe('useApp', () => {
  it('exige estar dentro de <AppProvider>', async () => {
    const { render } = await import('@testing-library/react');
    const { useApp } = await import('../../src/store/AppContext');
    function Suelto() {
      useApp();
      return null;
    }
    expect(() => render(<Suelto />)).toThrow(/AppProvider/);
  });
});
