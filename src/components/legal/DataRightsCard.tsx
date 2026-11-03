import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import {
  LEGAL_UPDATED_AT,
  MARKETING_PURPOSE,
  PURPOSES,
  RESPONSABLE,
  RETENTION_MONTHS,
  SUBJECT_RIGHTS,
} from '../../data/legal';
import { useApp } from '../../store/AppContext';
import { useConsent } from '../../store/ConsentContext';
import { formatDateTime } from '../../lib/format';
import { Card, SectionTitle } from '../ui/Primitives';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Field';
import { Modal } from '../ui/Modal';

/**
 * Panel de habeas data del titular: muestra la autorización vigente y permite
 * ejercer los derechos del artículo 8 de la Ley 1581 de 2012 —conocer,
 * actualizar, obtener copia, revocar y suprimir— sin salir de la aplicación.
 */
export function DataRightsCard() {
  const { user, orders, resetDemo, toast } = useApp();
  const { consent, setMarketing, revoke } = useConsent();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  /** Derecho de acceso: entrega al titular una copia de sus datos en JSON. */
  const download = () => {
    const payload = {
      generadoEl: new Date().toISOString(),
      responsable: RESPONSABLE,
      titular: user ? { id: user.id, nombre: user.name, correo: user.email, rol: user.role } : null,
      autorizacion: consent,
      pedidos: orders.filter((o) => o.userId === user?.id),
      nota:
        'Copia de los datos personales que Reverde trata sobre el titular, entregada en ejercicio del ' +
        'derecho de acceso previsto en la Ley 1581 de 2012.',
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `reverde-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Copia descargada', description: 'Incluye tu autorización y tus pedidos.', tone: 'success' });
  };

  const doRevoke = () => {
    revoke();
    resetDemo();
    setConfirming(false);
    toast({
      title: 'Autorización revocada',
      description: 'Eliminamos tus datos de este dispositivo y el registro de tu consentimiento.',
      tone: 'info',
    });
    navigate('/');
  };

  return (
    <>
      <Card className="p-4 sm:p-5">
        <SectionTitle
          title="Privacidad y datos personales"
          subtitle="Tu autorización de habeas data y los derechos que puedes ejercer."
          action={
            consent ? (
              <Badge tone="green" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Autorizado
              </Badge>
            ) : (
              <Badge tone="amber">Sin autorización</Badge>
            )
          }
        />

        {consent && (
          <div className="mt-4 rounded-2xl bg-canvas p-4">
            <dl className="grid gap-2.5 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-ink-faint">Autorización otorgada</dt>
                <dd className="font-semibold text-ink">{formatDateTime(consent.acceptedAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Documento aceptado</dt>
                <dd className="font-semibold text-ink">Versión {consent.version} del {LEGAL_UPDATED_AT}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Finalidades autorizadas</dt>
                <dd className="font-semibold text-ink">{PURPOSES.length} finalidades del servicio</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Conservación</dt>
                <dd className="font-semibold text-ink">Hasta {RETENTION_MONTHS} meses tras tu última actividad</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-4 border-t border-black/5 pt-4">
          <Toggle
            checked={Boolean(consent?.marketing)}
            onChange={(v) => {
              setMarketing(v);
              toast({
                title: v ? 'Comunicaciones activadas' : 'Comunicaciones desactivadas',
                description: v
                  ? 'Te avisaremos cuando haya productos rescatados cerca de ti.'
                  : 'Retiramos tu autorización para enviarte comunicaciones comerciales.',
                tone: 'info',
              });
            }}
            label={MARKETING_PURPOSE.label + ' (finalidad opcional)'}
          />
          <p className="mt-1.5 pl-[56px] text-[12.5px] leading-relaxed text-ink-soft">
            Puedes retirar esta autorización sin perder acceso a la plataforma.
          </p>
        </div>

        <div className="mt-4 border-t border-black/5 pt-4">
          <p className="text-[13px] font-bold text-ink">Tus derechos como titular</p>
          <ul className="mt-2 space-y-1.5">
            {SUBJECT_RIGHTS.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
            Canal de atención: {RESPONSABLE.email} · {RESPONSABLE.phone} · {RESPONSABLE.hours} Las consultas se
            responden en 10 días hábiles y los reclamos en 15 días hábiles.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-black/5 pt-4">
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={download}>
            Descargar mis datos
          </Button>
          <Button variant="ghost" size="sm" to="/legal/privacidad" icon={<FileText className="h-4 w-4" />}>
            Ver la política
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirming(true)}
          >
            Revocar autorización y eliminar mis datos
          </Button>
        </div>

        {consent && consent.log.length > 0 && (
          <details className="mt-4 border-t border-black/5 pt-4">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-700">
              Historial de mi consentimiento ({consent.log.length})
            </summary>
            <ul className="mt-2.5 space-y-2">
              {[...consent.log].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} className="text-[12.5px] leading-snug text-ink-soft">
                  <span className="font-semibold text-ink">{formatDateTime(e.at)}</span> · {e.action} · {e.detail}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title="¿Revocar tu autorización?"
        subtitle="Esta acción elimina tus datos de este dispositivo y no se puede deshacer."
        footer={
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button block variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={doRevoke}>
              Revocar y eliminar
            </Button>
            <Button block variant="outline" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-ink-soft">
          Al revocar la autorización suprimimos tu sesión, tus pedidos y el registro de tu consentimiento.
          Volverás a la página pública y podrás autorizar de nuevo cuando quieras.
        </p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
          Ten en cuenta que la ley permite conservar la información que respalde una obligación contractual,
          contable o tributaria vigente, como el soporte de una compra ya realizada.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
          Si prefieres conservar tu historial, puedes{' '}
          <Link to="/legal/habeas-data" className="font-semibold text-brand-700 hover:underline">
            revisar primero el alcance de la autorización
          </Link>
          .
        </p>
      </Modal>
    </>
  );
}
