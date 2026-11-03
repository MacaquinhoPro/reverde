import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, Lock, ShieldCheck, XCircle } from 'lucide-react';
import {
  HABEAS_DATA,
  HABEAS_DATA_STATEMENT,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  MARKETING_PURPOSE,
  PURPOSES,
  RESPONSABLE,
} from '../../data/legal';
import { useApp } from '../../store/AppContext';
import { useConsent } from '../../store/ConsentContext';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Field';
import { cx } from '../../lib/format';
import { LegalDocBody } from './LegalBody';

/**
 * Compuerta de consentimiento: solicita la autorización previa, expresa e
 * informada del titular antes de usar la plataforma (Ley 1581 de 2012,
 * art. 9). Las casillas obligatorias nacen desmarcadas y no se puede cerrar
 * sin decidir: aceptar o rechazar de forma explícita.
 */
export function ConsentGate() {
  const { accept } = useConsent();
  const { user, toast } = useApp();
  const navigate = useNavigate();

  const [terms, setTerms] = useState(false);
  const [dataProcessing, setDataProcessing] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const onAccept = () => {
    if (!terms || !dataProcessing) {
      setError('Para continuar debes aceptar los términos y autorizar el tratamiento de tus datos.');
      return;
    }
    accept(
      { terms, dataProcessing, marketing },
      user ? { userId: user.id, email: user.email } : undefined,
    );
    toast({
      title: 'Autorización registrada',
      description: `Guardamos la fecha y la versión ${LEGAL_VERSION} como prueba de tu consentimiento.`,
      tone: 'success',
    });
  };

  const body = declined ? (
    <div className="py-2">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FCEDEC] text-[#B4453D]">
        <XCircle className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-[19px] font-bold text-ink">No registramos tu autorización</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
        Respetamos tu decisión: sin tu autorización no podemos crear tu cuenta, procesar pedidos ni
        reservar productos, porque esos datos son necesarios para prestarte el servicio. Nada de lo que
        viste quedó guardado.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
        Puedes seguir consultando la información pública de Reverde, o volver a esta pantalla cuando
        quieras autorizar el tratamiento de tus datos.
      </p>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Button variant="outline" block onClick={() => { setDeclined(false); setError(null); }}>
          Volver a revisar
        </Button>
        <Button block onClick={() => navigate('/')}>
          Ir a la página pública
        </Button>
      </div>
    </div>
  ) : (
    <>
      <header className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[19px] font-bold leading-tight text-ink">Protección de datos personales</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Antes de continuar necesitamos tu autorización para tratar tus datos (habeas data · Ley 1581 de 2012).
          </p>
        </div>
      </header>

      <div className="mt-5 rounded-2xl bg-canvas p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Responsable</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink">
          {RESPONSABLE.legalName} · {RESPONSABLE.address} ·{' '}
          <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${RESPONSABLE.email}`}>
            {RESPONSABLE.email}
          </a>
        </p>
      </div>

      <div className="mt-4">
        <p className="text-[13px] font-bold text-ink">¿Para qué usamos tus datos?</p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {PURPOSES.map((p) => (
            <li key={p.id} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              {p.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
          Tus derechos: conocer, actualizar y rectificar tus datos, solicitar prueba de esta autorización,
          revocarla y pedir la supresión de tus datos en cualquier momento.
        </p>
      </div>

      {/* Texto de la autorización */}
      <div className="mt-4 rounded-2xl border border-black/5 bg-white">
        <p className="px-4 pt-4 text-[13px] leading-relaxed text-ink">
          <FileText className="mr-1.5 inline h-3.5 w-3.5 text-brand-700" />
          {HABEAS_DATA_STATEMENT}
        </p>
        <button
          type="button"
          onClick={() => setShowFullText((s) => !s)}
          className="mt-2 inline-flex w-full items-center justify-between gap-2 px-4 pb-3.5 text-[12.5px] font-semibold text-brand-700"
        >
          {showFullText ? 'Ocultar el texto completo' : 'Leer el texto completo de la autorización'}
          <ChevronDown className={cx('h-4 w-4 transition-transform', showFullText && 'rotate-180')} />
        </button>
        {showFullText && (
          <div className="no-scrollbar max-h-64 overflow-y-auto border-t border-black/5 px-4 py-3">
            <LegalDocBody doc={HABEAS_DATA} />
          </div>
        )}
      </div>

      {/* Casillas */}
      <div className="mt-5 space-y-3.5">
        <Checkbox
          required
          checked={terms}
          onChange={(v) => { setTerms(v); setError(null); }}
          label={
            <>
              He leído y acepto los{' '}
              <Link to="/legal/terminos" target="_blank" className="font-semibold text-brand-700 hover:underline">
                Términos y condiciones
              </Link>{' '}
              y la{' '}
              <Link to="/legal/privacidad" target="_blank" className="font-semibold text-brand-700 hover:underline">
                Política de tratamiento de datos personales
              </Link>
              .
            </>
          }
        />
        <Checkbox
          required
          checked={dataProcessing}
          onChange={(v) => { setDataProcessing(v); setError(null); }}
          label={
            <>
              Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales para
              las finalidades señaladas.
            </>
          }
          hint="Necesario para crear tu cuenta y procesar pedidos o reservas."
        />
        <Checkbox
          checked={marketing}
          onChange={setMarketing}
          label={<>{MARKETING_PURPOSE.label} (opcional)</>}
          hint={MARKETING_PURPOSE.detail}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-[#FCEDEC] px-3.5 py-2.5 text-[13px] font-medium text-[#B4453D]">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
        <Button block size="lg" onClick={onAccept} icon={<ShieldCheck className="h-4 w-4" />}>
          Autorizo y continúo
        </Button>
        <Button block size="lg" variant="outline" onClick={() => setDeclined(true)}>
          No autorizo
        </Button>
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
        <Lock className="h-3 w-3 shrink-0" />
        Versión {LEGAL_VERSION} del {LEGAL_UPDATED_AT}. Guardamos la fecha y la hora de tu autorización
        como prueba del consentimiento, tal como lo exige la ley.
      </p>
    </>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Autorización de tratamiento de datos personales"
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
    >
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[3px]" />
      <div className="no-scrollbar relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift animate-slide-up sm:max-w-xl sm:rounded-3xl sm:p-7 sm:animate-scale-in">
        {body}
      </div>
    </div>,
    document.body,
  );
}
