/**
 * Canal de reporte de errores y sugerencias desde la aplicación.
 *
 * El reporte abre un issue **prellenado** en GitHub en vez de enviarse a un
 * backend propio, por tres razones: no hay servidor de soporte que lo reciba
 * (la SPA funciona sola), el issue queda donde el equipo ya trabaja, y así el
 * informe no se pierde en un correo.
 *
 * **Lo que se incluye y lo que no.** Van la ruta, el tamaño de la pantalla, el
 * navegador y la versión de la demo, porque son lo primero que se pregunta al
 * reproducir un fallo. **No va ningún dato personal**: ni correo, ni nombre, ni
 * el contenido del almacenamiento. Si hiciera falta más, lo escribe la persona.
 */
import { SEED_VERSION } from './demoState';

/** `TODO:` confirmar que este es el repositorio definitivo del proyecto. */
export const REPO = 'MacaquinhoPro/reverde';

export type FeedbackKind = 'bug' | 'idea';

/** Contexto técnico mínimo para poder reproducir. Sin datos personales. */
export function technicalContext(): Record<string, string> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const win = typeof window === 'undefined' ? undefined : window;
  return {
    Ruta: win ? `${win.location.pathname}${win.location.search}` : 'desconocida',
    Pantalla: win ? `${win.innerWidth}×${win.innerHeight}` : 'desconocida',
    Navegador: nav?.userAgent ?? 'desconocido',
    Idioma: nav?.language ?? 'desconocido',
    'Versión de la demo': String(SEED_VERSION),
    Fecha: new Date().toISOString(),
  };
}

const PLANTILLA_BUG = (contexto: string) => `### Qué pasó

<!-- Describe el problema en una o dos frases -->

### Qué esperabas que pasara

### Pasos para reproducirlo

1.
2.
3.

### Contexto técnico

${contexto}

<!-- Reportado desde la aplicación. No incluye datos personales. -->`;

const PLANTILLA_IDEA = (contexto: string) => `### Qué te gustaría poder hacer

<!-- Describe la idea desde lo que quieres lograr, no desde la solución -->

### Por qué ayudaría

### Cómo lo resuelves hoy

### Contexto técnico

${contexto}

<!-- Enviado desde la aplicación. -->`;

/**
 * URL de un issue prellenado. Si el reporte queda demasiado largo para una
 * URL, se recorta el cuerpo: más vale un issue abierto con menos detalle que
 * un enlace que el navegador rechaza.
 */
export function feedbackUrl(kind: FeedbackKind, titulo = ''): string {
  const contexto = Object.entries(technicalContext())
    .map(([k, v]) => `- **${k}:** ${v}`)
    .join('\n');

  const cuerpo = kind === 'bug' ? PLANTILLA_BUG(contexto) : PLANTILLA_IDEA(contexto);
  const params = new URLSearchParams({
    labels: kind === 'bug' ? 'bug' : 'sugerencia',
    title: titulo || (kind === 'bug' ? '[Error] ' : '[Sugerencia] '),
    body: cuerpo.length > 6000 ? `${cuerpo.slice(0, 6000)}\n\n…(recortado)` : cuerpo,
  });

  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}
