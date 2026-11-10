/**
 * Tokens de diseño de Reverde · única fuente de verdad.
 *
 * Los consume `tailwind.config.js` (de donde salen todas las clases de
 * utilidad) y se replican como variables CSS en `src/index.css` para lo que
 * quede fuera de Tailwind (SVG en línea, estilos calculados, correo).
 *
 * Al cambiar un valor aquí cambia en toda la aplicación. Si el token se usa
 * también en `src/index.css`, actualiza las dos partes: la guía de estilos
 * está documentada en `docs/diseno/ui-kit.md`.
 */

/** Paleta de marca. El 700 es el verde institucional de Reverde. */
export const colors = {
  brand: {
    50: '#F2F9F5',
    100: '#DDEFE4',
    200: '#C2E2CE',
    300: '#9ECFB2',
    400: '#72B58B',
    500: '#4E9A6C',
    600: '#357C53',
    700: '#1F5D42', // verde principal · acciones primarias
    800: '#174734',
    900: '#0F3324',
  },
  /** Texto. `DEFAULT` para titulares y cuerpo, `soft` de apoyo, `faint` placeholders. */
  ink: { DEFAULT: '#1C2822', soft: '#6B756F', faint: '#9BA5A0' },
  /** Lienzo de la aplicación. */
  canvas: '#F8FBF9',
  /**
   * Niveles de riesgo. Validados por separación cromática bajo daltonismo:
   * el color NUNCA es la única señal — todo badge lleva texto e icono.
   */
  risk: { low: '#3F9E6B', mid: '#D99A2B', high: '#D96A63' },
  /** Serie de gráficas (Recharts). Mismo criterio de accesibilidad. */
  chart: { ok: '#3F9E6B', warn: '#E0A81C', bad: '#C8453E' },
};

export const fontFamily = {
  sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
};

/**
 * Escala tipográfica: [tamaño, { lineHeight, letterSpacing }].
 * Los titulares van con tracking negativo (-0.02em), como en `index.css`.
 */
export const fontSize = {
  'display-lg': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
  display: ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
  'title-lg': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
  title: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
  'body-lg': ['1rem', { lineHeight: '1.6' }],
  body: ['0.875rem', { lineHeight: '1.6' }],
  caption: ['0.8125rem', { lineHeight: '1.5' }],
  micro: ['0.75rem', { lineHeight: '1.4' }],
};

/**
 * Espaciados semánticos. Se SUMAN a la escala por defecto de Tailwind
 * (`p-4`, `gap-6`, …), que sigue siendo válida; estos nombran las medidas
 * que se repiten en el layout.
 */
export const spacing = {
  gutter: '1rem', // margen lateral en móvil
  'gutter-lg': '1.5rem', // margen lateral en escritorio
  section: '2rem', // separación entre bloques de una pantalla
  'section-lg': '3rem',
  sidebar: '15rem', // ancho de la barra lateral del panel
  'nav-mobile': '4.25rem', // alto de la navegación inferior
  field: '2.75rem', // alto mínimo de control táctil (≥ 44 px)

  /**
   * Zonas seguras del dispositivo. En un iPhone el navegador reserva espacio
   * para la isla dinámica arriba y para el indicador de inicio abajo; sin esto
   * el contenido queda debajo de ellos. Requieren `viewport-fit=cover` en
   * `index.html`, que ya está puesto. En un equipo sin muescas valen 0.
   */
  'safe-top': 'env(safe-area-inset-top, 0px)',
  'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
  'safe-left': 'env(safe-area-inset-left, 0px)',
  'safe-right': 'env(safe-area-inset-right, 0px)',

  /**
   * Espacio que el contenido debe dejar libre al final de la página para no
   * quedar tapado por la navegación inferior fija: su alto, más el indicador
   * de inicio, más un respiro.
   */
  'nav-safe': 'calc(4.25rem + env(safe-area-inset-bottom, 0px) + 0.75rem)',
};

export const borderRadius = { xl: '14px', '2xl': '20px', '3xl': '28px' };

export const boxShadow = {
  soft: '0 1px 2px rgba(28,40,34,0.04), 0 4px 16px rgba(28,40,34,0.05)',
  lift: '0 2px 4px rgba(28,40,34,0.05), 0 12px 32px rgba(28,40,34,0.09)',
  glow: '0 8px 30px rgba(31,93,66,0.18)',
};

/** Curva y duraciones del movimiento. Una sola curva en toda la app. */
export const motion = {
  easing: 'cubic-bezier(.22,1,.36,1)',
  fast: '.2s',
  base: '.3s',
  slow: '.45s',
};

export const keyframes = {
  'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
  'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
  'scale-in': { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
  'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
  'pulse-ring': { '0%': { transform: 'scale(.9)', opacity: '.7' }, '70%': { transform: 'scale(1.6)', opacity: '0' }, '100%': { opacity: '0' } },
};

export const animation = {
  'fade-up': `fade-up ${motion.slow} ${motion.easing} both`,
  'fade-in': `fade-in .35s ease both`,
  'scale-in': `scale-in .25s ${motion.easing} both`,
  'slide-up': `slide-up ${motion.base} ${motion.easing} both`,
  'pulse-ring': 'pulse-ring 2s ease-out infinite',
};

/** Puntos de quiebre reales del diseño (los de Tailwind por defecto). */
export const screens = {
  sm: '640px',
  md: '768px', // ← corte entre la experiencia móvil y la de escritorio
  lg: '1024px',
  xl: '1280px',
};

export const tokens = {
  colors,
  fontFamily,
  fontSize,
  spacing,
  borderRadius,
  boxShadow,
  motion,
  keyframes,
  animation,
  screens,
};

export default tokens;
