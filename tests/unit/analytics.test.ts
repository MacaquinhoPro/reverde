import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureError,
  configureAnalytics,
  consoleSink,
  isAnalyticsEnabled,
  noopSink,
  resetAnalytics,
  setAnalyticsConsent,
  setAnalyticsContext,
  track,
  type AnalyticsSink,
} from '../../src/lib/analytics';

/** Sumidero de prueba que recuerda todo lo que recibe. */
function spySink() {
  const events: { name: string; props: unknown }[] = [];
  const contexts: unknown[] = [];
  const errors: { error: unknown; context?: Record<string, unknown> }[] = [];
  const sink: AnalyticsSink = {
    name: 'spy',
    track: (name, props) => events.push({ name, props }),
    setContext: (context) => contexts.push(context),
    captureError: (error, context) => errors.push({ error, context }),
  };
  return { sink, events, contexts, errors };
}

beforeEach(() => resetAnalytics());

describe('consentimiento · Ley 1581 de 2012', () => {
  it('no registra nada antes de la autorización', () => {
    const { sink, events } = spySink();
    configureAnalytics(sink);

    track('impact_viewed', { role: 'cliente' });

    expect(events).toEqual([]);
  });

  it('registra solo después de autorizar', () => {
    const { sink, events } = spySink();
    configureAnalytics(sink);
    setAnalyticsConsent(true);

    track('impact_viewed', { role: 'cliente' });

    expect(events).toEqual([{ name: 'impact_viewed', props: { role: 'cliente' } }]);
  });

  it('deja de registrar al revocar la autorización', () => {
    const { sink, events } = spySink();
    configureAnalytics(sink);
    setAnalyticsConsent(true);
    track('demo_reset', {});
    setAnalyticsConsent(false);
    track('demo_reset', {});

    expect(events).toHaveLength(1);
  });

  it('NO encola los eventos descartados: medir no justifica guardar datos sin autorización', () => {
    const { sink, events } = spySink();
    configureAnalytics(sink);

    track('catalog_viewed', { source: 'explorar' });
    track('catalog_viewed', { source: 'inicio' });
    setAnalyticsConsent(true);

    // Al autorizar no aparece nada de antes: se descartaron, no se guardaron.
    expect(events).toEqual([]);
  });

  it('olvida el contexto al revocar', () => {
    const { sink, contexts } = spySink();
    configureAnalytics(sink);
    setAnalyticsConsent(true);
    setAnalyticsContext({ role: 'supermercado', establishmentId: 'sup-1' });
    setAnalyticsConsent(false);
    setAnalyticsConsent(true);
    setAnalyticsContext({ role: 'cliente' });

    // El último contexto no arrastra el establecimiento anterior.
    expect(contexts.at(-1)).toEqual({ role: 'cliente' });
  });
});

describe('estado del proveedor', () => {
  it('por defecto no hay proveedor y la medición está apagada', () => {
    expect(isAnalyticsEnabled()).toBe(false);
    setAnalyticsConsent(true);
    // Con autorización pero sin proveedor sigue apagada: no hay a dónde enviar.
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it('se considera habilitada con proveedor y autorización', () => {
    configureAnalytics(spySink().sink);
    setAnalyticsConsent(true);
    expect(isAnalyticsEnabled()).toBe(true);
  });

  it('el sumidero por defecto no lanza ni hace nada', () => {
    configureAnalytics(noopSink);
    setAnalyticsConsent(true);
    expect(() => track('demo_reset', {})).not.toThrow();
  });

  it('aplica el contexto pendiente al conectar un proveedor', () => {
    setAnalyticsConsent(true);
    setAnalyticsContext({ role: 'superadmin' });
    const { sink, contexts } = spySink();
    configureAnalytics(sink);
    expect(contexts).toContainEqual({ role: 'superadmin' });
  });
});

describe('robustez', () => {
  it('un proveedor que falla no tumba la aplicación', () => {
    configureAnalytics({
      name: 'roto',
      track: () => {
        throw new Error('el proveedor de métricas se cayó');
      },
    });
    setAnalyticsConsent(true);

    expect(() => track('order_failed', { reason: 'error' })).not.toThrow();
  });

  it('captureError funciona sin autorización: es información técnica, no del titular', () => {
    const { sink, errors } = spySink();
    configureAnalytics(sink);

    captureError(new Error('fallo de render'), { boundary: 'app' });

    expect(errors).toHaveLength(1);
    expect(errors[0].context).toMatchObject({ boundary: 'app' });
  });

  it('captureError tolera un proveedor sin esa capacidad', () => {
    configureAnalytics({ name: 'minimo', track: () => {} });
    expect(() => captureError(new Error('x'))).not.toThrow();
  });

  it('el sumidero de consola imprime sin lanzar', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    configureAnalytics(consoleSink);
    setAnalyticsConsent(true);

    track('session_started', { role: 'cliente', via: 'acceso_rapido' });
    setAnalyticsContext({ role: 'cliente' });
    captureError(new Error('x'));

    expect(debug).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    debug.mockRestore();
    error.mockRestore();
  });
});

describe('privacidad del catálogo', () => {
  /**
   * Barrera contra el error más fácil de cometer al añadir un evento: meter un
   * dato personal. Si esta prueba falla, hay que rediseñar el evento, no la
   * prueba. Ver docs/analytics.md.
   */
  it('ningún evento del catálogo acepta datos personales', () => {
    const { sink, events } = spySink();
    configureAnalytics(sink);
    setAnalyticsConsent(true);

    track('order_completed', {
      mode: 'compra',
      paymentMethod: 'tarjeta',
      itemCount: 2,
      totalCop: 8400,
      savingsCop: 5600,
      wasteAvoidedKg: 1.4,
    });

    const props = Object.keys(events[0].props as object);
    const prohibidas = ['email', 'correo', 'name', 'nombre', 'phone', 'telefono', 'documento', 'userId', 'address'];
    expect(props.filter((k) => prohibidas.includes(k))).toEqual([]);
  });
});
