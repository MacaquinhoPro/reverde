import { useId, useState } from 'react';
import { Bug, Check, Copy, ExternalLink, Lightbulb, Mail, ShieldCheck } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Checkbox, Input, Textarea } from './ui/Field';
import { feedbackUrl } from '../lib/feedback';
import { reportMailto, saveReport, technicalLines, type Report, type ReportKind } from '../lib/reports';
import { RESPONSABLE } from '../data/legal';
import { useApp } from '../store/AppContext';
import { cx } from '../lib/format';

/**
 * Formulario de reporte, disponible desde cualquier pantalla.
 *
 * Dos pasos: se escribe y se envía; después aparece el código de seguimiento
 * y las dos vías para hacerlo llegar. El reporte queda guardado en la
 * aplicación aunque la persona no haga nada más, así que el canal nunca
 * «se pierde» por no tener cuenta de correo a mano.
 */
export function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useApp();
  const [kind, setKind] = useState<ReportKind>('error');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [withContext, setWithContext] = useState(true);
  const [sent, setSent] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idMensaje = useId();
  const idCorreo = useId();

  const cerrar = () => {
    onClose();
    // Se limpia después de la animación de salida, para que no parpadee.
    window.setTimeout(() => {
      setSent(null);
      setMessage('');
      setEmail('');
      setError(null);
      setKind('error');
    }, 250);
  };

  const enviar = () => {
    if (message.trim().length < 10) {
      setError('Cuéntanos un poco más: al menos diez caracteres.');
      return;
    }
    setError(null);
    const report = saveReport({ kind, message, email, withContext });
    setSent(report);
    toast({
      title: 'Reporte registrado',
      description: `Código ${report.code}`,
      tone: 'success',
    });
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={sent ? 'Gracias por avisarnos' : 'Reportar un problema'}
      subtitle={
        sent
          ? 'Guardamos tu reporte en la aplicación. Si quieres que llegue a una persona, envíalo por una de estas vías.'
          : 'Cuéntanos qué pasó. Sirve igual si es un error o una idea.'
      }
      size="sm"
      footer={
        sent ? (
          <Button block onClick={cerrar}>
            Listo
          </Button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button block onClick={enviar} icon={<Check className="h-4 w-4" />}>
              Enviar reporte
            </Button>
            <Button block variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
          </div>
        )
      }
    >
      {sent ? (
        <div className="space-y-4 pt-1">
          <div className="rounded-2xl bg-brand-50 p-4 text-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand-600">
              Tu código de seguimiento
            </p>
            <p className="mt-1 text-[26px] font-extrabold tracking-tight text-brand-700">{sent.code}</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(sent.code);
                toast({ title: 'Código copiado', description: sent.code, tone: 'info' });
              }}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={reportMailto(sent)}
              className="inline-flex min-h-field items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-800"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Enviarlo por correo
            </a>
            <a
              href={feedbackUrl(sent.kind === 'error' ? 'bug' : 'idea')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-field items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-ink transition-all duration-200 hover:border-brand-300 hover:bg-brand-50"
            >
              Abrirlo en GitHub
              <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </a>
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            También puedes escribir a {RESPONSABLE.email} citando el código. Tus reportes quedan
            listados en tu perfil.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <fieldset className="border-0 p-0">
            <legend className="label-base">¿Qué nos quieres contar?</legend>
            <div className="mt-1 grid grid-cols-2 gap-2.5">
              {(
                [
                  { value: 'error', label: 'Algo no funciona', icon: Bug },
                  { value: 'idea', label: 'Una idea', icon: Lightbulb },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={kind === o.value}
                  onClick={() => setKind(o.value)}
                  className={cx(
                    'flex min-h-field items-center justify-center gap-2 rounded-xl border px-3 text-[13.5px] font-semibold transition-all duration-200',
                    kind === o.value
                      ? 'border-brand-700 bg-brand-50 text-brand-700'
                      : 'border-black/10 bg-white text-ink-soft hover:border-brand-300',
                  )}
                >
                  <o.icon className="h-4 w-4" aria-hidden="true" />
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="label-base" htmlFor={idMensaje}>
              Cuéntanos qué pasó
            </label>
            <Textarea
              id={idMensaje}
              rows={5}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Por ejemplo: al tocar «Publicar» en un producto no pasa nada."
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${idMensaje}-error` : undefined}
            />
            {error && (
              <p id={`${idMensaje}-error`} role="alert" className="mt-1.5 text-xs font-medium text-[#B4453D]">
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="label-base" htmlFor={idCorreo}>
              Tu correo <span className="font-normal text-ink-faint">(opcional, solo si quieres respuesta)</span>
            </label>
            <Input
              id={idCorreo}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div className="rounded-2xl border border-black/5 bg-brand-50/50 p-3.5">
            <Checkbox
              checked={withContext}
              onChange={setWithContext}
              label="Adjuntar el contexto técnico"
              hint="Pantalla en la que estás, tamaño de ventana, navegador e idioma. Nada de esto te identifica."
            />
            {withContext && (
              <ul className="mt-3 space-y-1 border-t border-black/5 pt-3">
                {technicalLines().map((linea) => (
                  <li key={linea} className="truncate text-[11.5px] text-ink-soft">
                    {linea}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
            <span>
              El reporte se guarda en este navegador. No enviamos nada a ningún sitio hasta que tú
              elijas cómo hacerlo llegar.
            </span>
          </p>
        </div>
      )}
    </Modal>
  );
}
