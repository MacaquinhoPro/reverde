import { Bug, ExternalLink, Lightbulb, MessageSquare } from 'lucide-react';
import { Card, SectionTitle } from './ui/Primitives';
import { RESPONSABLE } from '../data/legal';
import { feedbackUrl } from '../lib/feedback';

/**
 * Canal de reporte dentro de la aplicación.
 *
 * Abre un issue prellenado en GitHub con el contexto técnico ya puesto (ruta,
 * pantalla, navegador, versión de la demo) y **sin ningún dato personal**. Ver
 * `src/lib/feedback.ts`.
 *
 * `target="_blank"` con `rel="noopener noreferrer"`: sin `noopener`, la pestaña
 * que se abre podría manipular la nuestra.
 */
export function FeedbackCard() {
  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="Reportar un problema o una idea"
        subtitle="Nos ayuda a arreglar lo que no funciona"
      />

      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
        Si algo se ve raro, no funciona o se te ocurre algo mejor, cuéntanos. El reporte se abre con
        los datos técnicos ya puestos (en qué pantalla estabas, qué navegador usas) y{' '}
        <strong className="font-semibold text-ink">no incluye ningún dato personal tuyo</strong>.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={feedbackUrl('bug')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-100 px-5 text-sm font-semibold text-brand-700 transition-all duration-200 hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          <Bug className="h-4 w-4" aria-hidden="true" />
          Reportar un error
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </a>
        <a
          href={feedbackUrl('idea')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-ink transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
          Proponer una mejora
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </a>
      </div>

      <p className="mt-4 flex items-start gap-2 border-t border-black/5 pt-4 text-[12.5px] leading-relaxed text-ink-faint">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          ¿Prefieres escribirnos? {RESPONSABLE.email} · {RESPONSABLE.hours}. Para ejercer tus
          derechos sobre tus datos personales, usa «Privacidad y datos personales».
        </span>
      </p>
    </Card>
  );
}
