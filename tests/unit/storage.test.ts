import { describe, expect, it, vi } from 'vitest';
import { load, resetAll, save } from '../../src/lib/storage';

const PREFIX = 'reverde.v1.';

describe('load / save', () => {
  it('guarda bajo el prefijo de la demo', () => {
    save('cart', [{ productId: 'p-1', qty: 2 }]);
    expect(localStorage.getItem(`${PREFIX}cart`)).toBe('[{"productId":"p-1","qty":2}]');
  });

  it('recupera el valor serializado', () => {
    save('user', { id: 'u-1', name: 'Laura' });
    expect(load('user', null)).toEqual({ id: 'u-1', name: 'Laura' });
  });

  it('devuelve el fallback cuando la clave no existe', () => {
    expect(load('inexistente', 'fallback')).toBe('fallback');
    expect(load('inexistente', [])).toEqual([]);
  });

  it('devuelve el fallback cuando el JSON está corrupto', () => {
    localStorage.setItem(`${PREFIX}products`, '{no es json');
    expect(load('products', [])).toEqual([]);
  });

  it('respeta los valores vacíos legítimos', () => {
    save('cart', []);
    expect(load('cart', [{ productId: 'x', qty: 1 }])).toEqual([]);
    save('user', null);
    expect(load('user', { id: 'u-1' })).toBeNull();
  });

  it('sobrevive a un almacenamiento no disponible (modo privado / cuota llena)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => save('products', [{ id: 'p-1' }])).not.toThrow();
    setItem.mockRestore();

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(load('products', 'fallback')).toBe('fallback');
    getItem.mockRestore();
  });
});

describe('resetAll', () => {
  it('borra solo las claves de la demo', () => {
    save('products', [1]);
    save('cart', [2]);
    localStorage.setItem('reverde.legal.consent', '{"terms":true}');
    localStorage.setItem('otra-app', 'intacto');

    resetAll();

    expect(load('products', null)).toBeNull();
    expect(load('cart', null)).toBeNull();
    // El consentimiento vive fuera del prefijo: es prueba legal, no dato de demo.
    expect(localStorage.getItem('reverde.legal.consent')).toBe('{"terms":true}');
    expect(localStorage.getItem('otra-app')).toBe('intacto');
  });

  it('no lanza si el almacenamiento falla', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    save('products', [1]);
    expect(() => resetAll()).not.toThrow();
    spy.mockRestore();
  });
});

/**
 * Regresión del hallazgo H-1 (docs/QA-PLAN.md): un valor del tipo equivocado
 * en `localStorage` dejaba la aplicación en blanco. El almacenamiento del
 * navegador es una entrada que no controlamos, así que `load` valida la forma
 * de lo leído y no solo que el JSON parsee.
 */
describe('load · tolerancia a valores con la forma equivocada (H-1)', () => {
  it('devuelve el valor por defecto si hay null guardado donde se espera una lista', () => {
    localStorage.setItem('reverde.v1.cart', 'null');
    expect(load('cart', [])).toEqual([]);
  });

  it('conserva el null guardado a propósito en un valor que no es lista (cerrar sesión)', () => {
    localStorage.setItem('reverde.v1.user', 'null');
    expect(load<unknown>('user', null)).toBeNull();
    // Incluso con un valor por defecto no nulo: revivir una sesión cerrada
    // sería peor que el error que se quiere evitar.
    expect(load<unknown>('user', { id: 'u-1' })).toBeNull();
  });

  it('devuelve el valor por defecto si hay un objeto donde se espera una lista', () => {
    localStorage.setItem('reverde.v1.products', '{"roto":true}');
    expect(load('products', [])).toEqual([]);
  });

  it('devuelve el valor por defecto si hay una lista donde se espera un objeto', () => {
    localStorage.setItem('reverde.v1.session', '[1,2,3]');
    expect(load('session', { id: 'x' })).toEqual({ id: 'x' });
  });

  it('devuelve el valor por defecto si hay un número o un texto donde se espera un objeto', () => {
    localStorage.setItem('reverde.v1.session', '42');
    expect(load('session', { id: 'x' })).toEqual({ id: 'x' });
    localStorage.setItem('reverde.v1.session', '"hola"');
    expect(load('session', { id: 'x' })).toEqual({ id: 'x' });
  });

  it('sigue devolviendo los valores primitivos válidos', () => {
    save('contador', 7);
    expect(load('contador', 0)).toBe(7);
    save('bandera', false);
    expect(load('bandera', true)).toBe(false);
    save('texto', 'hola');
    expect(load('texto', '')).toBe('hola');
  });

  it('devuelve las listas y objetos válidos sin tocarlos', () => {
    save('cart', [{ productId: 'p1', quantity: 2 }]);
    expect(load('cart', [])).toEqual([{ productId: 'p1', quantity: 2 }]);
  });
});
