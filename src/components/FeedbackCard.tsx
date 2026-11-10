import { Bug, ExternalLink, Lightbulb, MessageSquare } from 'lucide-react';
import { Card, SectionTitle } from './ui/Primitives';
import { Button } from './ui/Button';
import { RESPONSABLE } from '../data/legal';
import { feedbackUrl } from '../lib/feedback';
import { KIND_LABEL, listReports } from '../lib/reports';
import { useReport } from '../store/ReportContext';
import { formatDateShort } from '../lib/format';

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
  const report = useReport();
  const previos = listReports().slice(0, 3);

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
        <Button block onClick={report.open} icon={<Bug className="h-4 w-4" aria-hidden="true" />}>
          Reportar un problema
        </Button>
        <a
          href={feedbackUrl('idea')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-field flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-ink transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
          Abrir un issue en GitHub
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </a>
      </div>

      {previos.length > 0 && (
        <div className="mt-4 border-t border-black/5 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Tus reportes
          </p>
          <ul className="mt-2 space-y-1.5">
            {previos.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-[12.5px]">
                <span className="rounded-md bg-brand-50 px-2 py-0.5 font-bold text-brand-700">
                  {r.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{KIND_LABEL[r.kind]}</span>
                <span className="shrink-0 text-ink-soft">{formatDateShort(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
