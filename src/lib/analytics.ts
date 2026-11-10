/**
 * Instrumentación de eventos de producto.
 *
 * El catálogo de eventos vive **en el tipo** `EventCatalog`: así `track()` no
 * acepta un nombre que no exista ni propiedades que no correspondan, y el
 * catálogo documentado en `docs/analytics.md` no se puede desincronizar del
 * código sin que el compilador lo note.
 *
 * No hay proveedor elegido todavía (ver `docs/analytics.md`), así que lo que
 * existe es el contrato y dos implementaciones: `noopSink` (por defecto) y
 * `consoleSink` (para desarrollo). Conectar un proveedor real es escribir un
 * `AnalyticsSink` y llamar a `configureAnalytics()` una vez al arrancar.
 *
 * ── Dos reglas de privacidad, por la Ley 1581 de 2012 ──────────────────────
 *
 *  1. **Nada se envía antes de la autorización.** `track()` descarta los
 *     eventos mientras no se haya llamado a `setAnalyticsConsent(true)`. Los
 *     eventos descartados NO se encolan: medir es una finalidad secundaria y no
 *     justifica guardar datos de quien no ha autorizado.
 *  2. **Ningún evento lleva datos personales.** Ni correo, ni nombre, ni
 *     teléfono, ni identificador de persona. Solo el rol, que es categórico, y
 *     magnitudes agregadas. Si un evento nuevo necesitara un dato personal,
 *     está mal diseñado: revisa `docs/analytics.md` antes de añadirlo.
 */

/* ─────────────────────────── Catálogo ─────────────────────────── */

export type Role = 'supermercado' | 'restaurante' | 'cliente' | 'superadmin';
export type RiskLevel = 'bajo' | 'medio' | 'alto';

/**
 * Nombre del evento → forma de sus propiedades.
 * `snake_case` en los nombres: es la convención que esperan la mayoría de las
 * herramientas de análisis.
 */
export interface EventCatalog {
  /* Sesión */
  session_started: { role: Role; via: 'formulario' | 'acceso_rapido' };
  session_ended: { role: Role };
  login_failed: { reason: 'credenciales' | 'cuenta_inexistente' | 'bloqueada' };

  /* Autorización de datos */
  consent_prompted: Record<string, never>;
  consent_granted: { version: string; optionalAccepted: boolean };
  consent_declined: Record<string, never>;

  /* Inventario */
  product_created: { category: string; riskLevel: RiskLevel };
  product_updated: { category: string };
  product_deleted: { category: string };
  inventory_filtered: { riskLevel: RiskLevel | 'todos' };
  inventory_searched: { hasResults: boolean };

  /* Inteligencia: el corazón del producto */
  alert_opened: { riskLevel: RiskLevel; riskScore: number };
  explanation_opened: { riskScore: number };
  recommendation_applied: { action: 'descuento' | 'publicar' | 'donar'; suggestedDiscount: number; riskScore: number };
  recommendation_ignored: { riskLevel: RiskLevel };

  /* Marketplace */
  listing_published: { category: string; discountPercent: number; daysToExpiry: number };
  listing_unpublished: { category: string };
  catalog_viewed: { source: 'inicio' | 'explorar' | 'mapa' };
  catalog_filtered: { facet: 'categoria' | 'vencimiento' | 'establecimiento' | 'orden' };
  catalog_searched: { hasResults: boolean };
  product_viewed: { category: string; discountPercent: number };

  /* Compra */
  cart_item_added: { category: string; quantity: number };
  cart_item_removed: { category: string };
  cart_limited_by_stock: { requested: number; available: number };
  checkout_started: { itemCount: number; totalCop: number };
  order_completed: {
    mode: 'compra' | 'reserva';
    paymentMethod: 'tarjeta' | 'pse' | 'nequi' | 'bancolombia' | 'establecimiento';
    itemCount: number;
    totalCop: number;
    savingsCop: number;
    wasteAvoidedKg: number;
  };
  order_failed: { reason: 'pago_rechazado' | 'sin_stock' | 'expirado' | 'error' };

  /* Impacto y operación */
  impact_viewed: { role: Role };
  demo_reset: Record<string, never>;

  /* Errores (los emite el ErrorBoundary) */
  app_error: { boundary: string; message: string };
}

export type EventName = keyof EventCatalog;

/* ─────────────────────────── Contrato ─────────────────────────── */

export interface AnalyticsSink {
  readonly name: string;
  track<K extends EventName>(name: K, props: EventCatalog[K]): void;
  /** Rol y establecimiento, nunca identidad. */
  setContext?(context: { role?: Role; establishmentId?: string }): void;
  captureError?(error: unknown, context?: Record<string, unknown>): void;
}

/** Por defecto no se envía nada: sin proveedor, medir es un coste sin beneficio. */
export const noopSink: AnalyticsSink = {
  name: 'noop',
  track: () => {},
};

/** Para desarrollo: imprime el evento con su forma real. */
export const consoleSink: AnalyticsSink = {
  name: 'console',
  track(name, props) {
    console.debug(`[analytics] ${name}`, props);
  },
  setContext(context) {
    console.debug('[analytics] contexto', context);
  },
  captureError(error, context) {
    console.error('[analytics] error capturado', error, context);
  },
};

/* ─────────────────────────── Estado ─────────────────────────── */

let sink: AnalyticsSink = noopSink;
let consentGranted = false;
let context: { role?: Role; establishmentId?: string } = {};

/** Conecta un proveedor. Se llama una vez al arrancar la aplicación. */
export function configureAnalytics(next: AnalyticsSink): void {
  sink = next;
  if (Object.keys(context).length > 0) sink.setContext?.(context);
}

/**
 * Habilita o deshabilita la medición según la autorización del titular.
 * Al revocarla se olvida el contexto: no queda rastro del rol ni del
 * establecimiento en memoria.
 */
export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  if (!granted) context = {};
}

export const isAnalyticsEnabled = (): boolean => consentGranted && sink !== noopSink;

/** Rol y establecimiento para los eventos siguientes. Nunca identidad. */
export function setAnalyticsContext(next: { role?: Role; establishmentId?: string }): void {
  context = { ...context, ...next };
  if (consentGranted) sink.setContext?.(context);
}

/**
 * Registra un evento del catálogo. Es deliberadamente infalible: un fallo del
 * proveedor de métricas no puede tumbar la aplicación.
 */
export function track<K extends EventName>(name: K, props: EventCatalog[K]): void {
  if (!consentGranted) return;
  try {
    sink.track(name, props);
  } catch {
    /* medir nunca debe romper el producto */
  }
}

/**
 * Captura un error para diagnóstico. **No** depende del consentimiento: un
 * error es información técnica necesaria para mantener el servicio seguro
 * (interés legítimo del responsable), y no lleva datos del titular.
 */
export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  try {
    sink.captureError?.(error, { ...extra, role: context.role });
  } catch {
    /* noop */
  }
}

/** Para las pruebas: vuelve al estado inicial. */
export function resetAnalytics(): void {
  sink = noopSink;
  consentGranted = false;
  context = {};
}
