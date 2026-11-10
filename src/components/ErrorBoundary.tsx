import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureError, track } from '../lib/analytics';
import { resetAll } from '../lib/storage';
import { feedbackUrl } from '../lib/feedback';

interface Props {
  children: ReactNode;
  /** Nombre del límite, para saber qué parte falló en el reporte. */
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * Último recurso ante un error de renderizado.
 *
 * Sin esto, una excepción en cualquier componente deja la pantalla **en
 * blanco**: React desmonta el árbol y no hay nada que mirar ni forma de salir.
 * Ya pasó una vez (hallazgo H-1 de docs/QA-PLAN.md, un `null` en
 * `localStorage`), y el fallo no era el error en sí sino que no hubiera salida.
 *
 * Ofrece las dos salidas que realmente sirven:
 *  1. **Reintentar** — para un fallo transitorio, sin perder el estado.
 *  2. **Reiniciar los datos** — para un estado persistido corrupto, que es la
 *     causa más probable en una aplicación que guarda todo en el navegador.
 *
 * Nota: un límite de error solo atrapa errores de **renderizado**. Los de
 * manejadores de eventos y promesas no pasan por aquí.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { boundary: this.props.name ?? 'app', componentStack: info.componentStack });
    track('app_error', { boundary: this.props.name ?? 'app', message: error.message.slice(0, 200) });
  }

  private retry = () => this.setState({ error: null });

  private resetData = () => {
    resetAll();
    window.location.href = '/';
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-gutter py-section">
        <div className="card max-w-md w-full p-7 text-center animate-fade-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FCEDEC]">
            <AlertTriangle className="h-6 w-6 text-[#B4453D]" aria-hidden="true" />
          </div>
          <h1 className="text-title font-bold text-ink">Algo se rompió</h1>
          <p className="mt-2 text-body text-ink-soft">
            La aplicación encontró un error inesperado y no pudo seguir mostrando esta pantalla.
            Nada de lo que hiciste se perdió.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Volver a intentar
            </button>
            <button
              type="button"
              onClick={this.resetData}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-ink transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
            >
              Reiniciar los datos y volver al inicio
            </button>
          </div>

          <p className="mt-4 text-micro text-ink-faint">
            Si vuelve a ocurrir,{' '}
            <a
              href={feedbackUrl('bug', '[Error] Pantalla de error al usar la aplicación')}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brand-700"
            >
              repórtalo aquí
            </a>
            . El reporte no incluye datos personales.
          </p>

          {/* El detalle técnico se puede desplegar, pero no asusta de entrada. */}
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-micro font-medium text-ink-soft">
              Detalle técnico
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-black/[0.03] p-3 text-[11px] leading-relaxed text-ink-soft">
              {error.name}: {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
