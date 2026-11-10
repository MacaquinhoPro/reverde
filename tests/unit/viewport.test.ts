import { describe, expect, it, vi } from 'vitest';
import { lockPinchZoom } from '../../src/lib/viewport';

/**
 * El zoom por pellizco alejaba la aplicación entera cuando se intentaba mover
 * el mapa. Estas pruebas fijan las dos mitades del arreglo: los gestos de
 * Safari y el respaldo por multitáctil.
 */
describe('lockPinchZoom', () => {
  /** Dispara un evento cancelable y dice si alguien lo canceló. */
  const disparar = (destino: Document, tipo: string, extra: Record<string, unknown> = {}): boolean => {
    const evento = new Event(tipo, { bubbles: true, cancelable: true });
    Object.assign(evento, extra);
    destino.dispatchEvent(evento);
    return evento.defaultPrevented;
  };

  it('cancela los tres gestos de pellizco de Safari', () => {
    const soltar = lockPinchZoom(document);
    for (const gesto of ['gesturestart', 'gesturechange', 'gestureend']) {
      expect(disparar(document, gesto), `${gesto} debería cancelarse`).toBe(true);
    }
    soltar();
  });

  it('cancela el desplazamiento con dos dedos, que solo puede ser un pellizco', () => {
    const soltar = lockPinchZoom(document);
    expect(disparar(document, 'touchmove', { touches: [{}, {}] })).toBe(true);
    soltar();
  });

  it('deja pasar el desplazamiento con un dedo: es el scroll normal', () => {
    const soltar = lockPinchZoom(document);
    expect(disparar(document, 'touchmove', { touches: [{}] })).toBe(false);
    soltar();
  });

  it('al soltar deja de interferir, para no dejar escuchas colgando', () => {
    const soltar = lockPinchZoom(document);
    soltar();
    expect(disparar(document, 'gesturestart')).toBe(false);
    expect(disparar(document, 'touchmove', { touches: [{}, {}] })).toBe(false);
  });

  it('registra los escuchas sin modo pasivo: si no, preventDefault no haría nada', () => {
    const añadir = vi.spyOn(document, 'addEventListener');
    const soltar = lockPinchZoom(document);

    const registrados = añadir.mock.calls.filter(([tipo]) =>
      ['gesturestart', 'gesturechange', 'gestureend', 'touchmove'].includes(String(tipo)),
    );
    expect(registrados).toHaveLength(4);
    for (const [tipo, , opciones] of registrados) {
      expect(opciones, `${String(tipo)} debe registrarse con passive: false`).toMatchObject({
        passive: false,
      });
    }

    soltar();
    añadir.mockRestore();
  });
});
