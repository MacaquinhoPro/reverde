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
