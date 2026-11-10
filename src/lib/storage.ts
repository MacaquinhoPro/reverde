const PREFIX = 'reverde.v1.';

/**
 * Lee un valor persistido, cayendo al valor por defecto cuando lo guardado no
 * tiene la forma esperada.
 *
 * `JSON.parse` no alcanza: el almacenamiento del navegador es una entrada que
 * no controlamos —la puede editar quien use la app, la puede dejar a medias
 * una pestaña que se cerró, y sobrevive a cambios de versión del código—, así
 * que hay que validar la **forma** de lo leído y no solo que el JSON parsee.
 *
 * La regla, con un matiz que importa:
 *
 *  - **Una lista siempre debe seguir siendo una lista.** Un `null` guardado
 *    donde se espera una lista es JSON válido, se devolvía tal cual, y la
 *    primera llamada a `.reduce()` dejaba la aplicación en blanco sin forma de
 *    recuperarse salvo limpiar el almacenamiento a mano (hallazgo **H-1** de
 *    docs/QA-PLAN.md).
 *  - **Pero un `null` guardado a propósito en un valor que no es lista se
 *    respeta**: es como se cierra la sesión (`save('user', null)`). Devolver
 *    ahí el valor por defecto reviviría una sesión ya cerrada, que es peor que
 *    el error que se quiere evitar. Lo cubre la prueba «respeta los valores
 *    vacíos legítimos».
 *
 * Por eso la comprobación es por *tipo de contenedor* —lista, objeto,
 * primitivo— y no simplemente «¿es null?».
 */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as T;
    const expectsList = Array.isArray(fallback);

    if (parsed === null || parsed === undefined) {
      // Una lista no puede ser null; cualquier otra cosa sí puede estar vacía.
      return expectsList ? fallback : parsed;
    }
    // Lista ↔ no lista: lo guardado es de otra versión o está manipulado.
    if (expectsList !== Array.isArray(parsed)) return fallback;
    // Se esperaba un objeto y llegó un número, un texto o un booleano.
    if (!expectsList && fallback !== null && typeof fallback === 'object' && typeof parsed !== 'object') {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible: la demo sigue funcionando en memoria */
  }
}

export function resetAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}
