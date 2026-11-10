/**
 * Control del zoom del navegador en móvil.
 *
 * **El problema que resuelve.** En el mapa, al pellizcar para alejar se
 * esperaba mover el mapa y lo que se alejaba era la aplicación entera: queda
 * diminuta en una esquina y hay que volver a acercarla a mano. Pasa en
 * cualquier pantalla, pero en el mapa es constante porque ahí el gesto de
 * pellizcar es el que uno espera usar.
 *
 * **Por qué no basta la etiqueta `viewport`.** `user-scalable=no` en el
 * `<meta>` funciona en Android, pero **Safari de iPhone la ignora a propósito
 * desde iOS 10** por accesibilidad. En un iPhone el único control real son los
 * eventos `gesture*`, que son de Safari y no están en ningún estándar.
 *
 * Así que hacen falta tres cosas a la vez:
 *
 * 1. `maximum-scale=1, user-scalable=no` en `index.html` → Android.
 * 2. `touch-action: pan-x pan-y` en la hoja de estilos → quita el zoom por
 *    doble toque y, en Chrome, también el de pellizco.
 * 3. Esta función → cancela los gestos de pellizco en Safari de iPhone.
 *
 * **Lo que se pierde.** Desactivar el zoom incumple la pauta WCAG 1.4.4, que
 * pide poder ampliar hasta el 200 %. Se asume a petición expresa, y se
 * compensa con lo que ya hace la interfaz: tipografía de 16 px en los campos,
 * objetivos táctiles de 44 px y ningún texto por debajo de 11 px. Además esto
 * **no** afecta al zoom de accesibilidad del sistema —el de Ajustes › Pantalla,
 * o el menú «Aa» de Safari—, que sigue funcionando porque no usa estos gestos.
 */

/** Eventos de gestos de Safari. No existen en la definición estándar del DOM. */
type EventoDeGesto = 'gesturestart' | 'gesturechange' | 'gestureend';

const GESTOS: EventoDeGesto[] = ['gesturestart', 'gesturechange', 'gestureend'];

/**
 * Cancela el zoom por pellizco y por doble toque.
 *
 * @returns Función para soltar los escuchas (las pruebas y el HMR la usan).
 */
export function lockPinchZoom(target: Document = document): () => void {
  /** Safari dispara estos tres al pellizcar; cancelarlos deja la escala quieta. */
  const cancelarGesto = (e: Event): void => {
    e.preventDefault();
  };

  /**
   * Respaldo para navegadores sin eventos `gesture*`: dos dedos moviéndose a
   * la vez solo pueden ser un pellizco. Un dedo se deja pasar intacto, que es
   * el desplazamiento normal de la página.
   */
  const cancelarPellizco = (e: TouchEvent): void => {
    if (e.touches.length > 1) e.preventDefault();
  };

  for (const nombre of GESTOS) {
    target.addEventListener(nombre, cancelarGesto, { passive: false });
  }
  target.addEventListener('touchmove', cancelarPellizco, { passive: false });

  return () => {
    for (const nombre of GESTOS) {
      target.removeEventListener(nombre, cancelarGesto);
    }
    target.removeEventListener('touchmove', cancelarPellizco);
  };
}
