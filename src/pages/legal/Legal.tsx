import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Mail, ShieldCheck, Scale } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Card } from '../../components/ui/Primitives';
import { Badge } from '../../components/ui/Badge';
import { LegalDocBody } from '../../components/legal/LegalBody';
import {
  LEGAL_DOCS,
  LEGAL_INDEX,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  RESPONSABLE,
  type LegalSlug,
} from '../../data/legal';

const ICONS: Record<LegalSlug, typeof FileText> = {
  terminos: Scale,
  privacidad: ShieldCheck,
  'habeas-data': FileText,
};

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-soft hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>

      <footer className="border-t border-black/5 bg-white py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 text-[12.5px] text-ink-faint sm:px-8">
          <p>
            Para ejercer tus derechos como titular de datos personales escribe a{' '}
            <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${RESPONSABLE.email}`}>
              {RESPONSABLE.email}
            </a>{' '}
            o entra a Perfil → Privacidad y datos personales.
          </p>
          <p>
            {RESPONSABLE.legalName} · {RESPONSABLE.address} · Versión {LEGAL_VERSION} del {LEGAL_UPDATED_AT}
          </p>
        </div>
      </footer>
    </div>
  );
}

function LegalIndex() {
  return (
    <Chrome>
      <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
        Protección de datos
      </Badge>
      <h1 className="mt-4 text-[30px] font-extrabold tracking-[-0.03em] text-ink">Centro legal</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Aquí están los documentos que rigen el uso de Reverde y el tratamiento de tus datos personales,
        conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015.
      </p>

      <div className="mt-8 space-y-3">
        {LEGAL_INDEX.map((doc) => {
          const Icon = ICONS[doc.slug];
          return (
            <Link key={doc.slug} to={`/legal/${doc.slug}`}>
              <Card className="group flex items-start gap-4 p-5" hover>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-ink">{doc.title}</span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-soft">{doc.summary}</span>
                </span>
                <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-brand-600 transition-transform group-hover:translate-x-0.5" />
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-6 flex items-start gap-3 p-5">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
        <div>
          <p className="text-[14px] font-bold text-ink">Canal de atención al titular</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            Consultas y reclamos sobre tus datos personales: {RESPONSABLE.email} · {RESPONSABLE.phone} ·{' '}
            {RESPONSABLE.hours}
          </p>
        </div>
      </Card>
    </Chrome>
  );
}

export default function LegalPage() {
  const { slug } = useParams<{ slug: LegalSlug }>();
  const doc = slug ? LEGAL_DOCS[slug] : undefined;

  if (!doc) return <LegalIndex />;

  const Icon = ICONS[doc.slug];

  return (
    <Chrome>
      <Link
        to="/legal"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Centro legal
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[27px] font-extrabold leading-tight tracking-[-0.03em] text-ink">{doc.title}</h1>
          <p className="mt-1.5 text-[13px] text-ink-faint">
            Versión {LEGAL_VERSION} · Vigente desde el {LEGAL_UPDATED_AT}
          </p>
        </div>
      </div>

      <Card className="mt-7 p-5 sm:p-7">
        <LegalDocBody doc={doc} />
      </Card>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {LEGAL_INDEX.filter((d) => d.slug !== doc.slug).map((d) => (
          <Link
            key={d.slug}
            to={`/legal/${d.slug}`}
            className="chip bg-white text-ink-soft ring-1 ring-black/5 hover:text-brand-700"
          >
            {d.title} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    </Chrome>
  );
}
