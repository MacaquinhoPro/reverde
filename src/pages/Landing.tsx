import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  ChevronRight,
  Leaf,
  LineChart,
  MapPin,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingDown,
  Utensils,
  Wallet,
} from 'lucide-react';
import { Logo, ReverdeMark } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Primitives';
import { cop } from '../lib/format';

const PILLARS = [
  {
    icon: Boxes,
    tag: '01 · Inventario inteligente',
    title: 'Todo tu inventario, con su riesgo a la vista',
    body: 'Registra productos con fecha de ingreso y vencimiento. Reverde calcula en tiempo real qué está en riesgo de convertirse en desperdicio y lo ordena por prioridad.',
    bullets: ['Risk Score 0–100 por producto', 'Estados bajo / medio / alto riesgo', 'Búsqueda, filtros y acciones rápidas'],
  },
  {
    icon: Sparkles,
    tag: '02 · Alertas y priorización con IA',
    title: 'La IA te dice qué hacer y por qué',
    body: 'Cada alerta explica los factores que la originan y propone una acción concreta: descuento, combo, caja de rescate o donación. El sistema aprende de los resultados anteriores.',
    bullets: ['Explicabilidad de cada recomendación', 'Descuento sugerido según histórico', 'Aplicar acción en un clic'],
  },
  {
    icon: ShoppingBag,
    tag: '03 · Marketplace',
    title: 'Conecta esos alimentos con quien los quiere',
    body: 'Publica en un clic al marketplace B2B2C. Los clientes cercanos encuentran productos frescos a mejor precio y tú recuperas valor antes de perderlo.',
    bullets: ['Reserva y compra simulada', 'Mapa de establecimientos cercanos', 'Impacto visible en cada compra'],
  },
];

const FLOW = [
  { icon: Boxes, title: 'Detecta', body: 'Reverde identifica qué alimentos tienen riesgo de convertirse en desperdicio.' },
  { icon: Sparkles, title: 'Decide', body: 'La IA recomienda qué hacer con ellos y explica el porqué de cada decisión.' },
  { icon: ShoppingBag, title: 'Recupera', body: 'Los conecta con compradores cercanos para recuperar valor antes de perderlos.' },
];

const STATS = [
  { value: '86,4 kg', label: 'Desperdicio evitado este mes', icon: Leaf },
  { value: cop(1840000), label: 'Pérdidas evitadas', icon: TrendingDown },
  { value: cop(1240000), label: 'Ingresos recuperados', icon: Wallet },
  { value: '128', label: 'Productos rescatados', icon: Boxes },
];

const ROLES = [
  { icon: Store, title: 'Supermercados', body: 'Inventario, alertas y publicación masiva de excedentes.', to: '/login?rol=supermercado' },
  { icon: Utensils, title: 'Restaurantes', body: 'Preparados del día que no se venden y cajas de rescate.', to: '/login?rol=restaurante' },
  { icon: ShoppingBag, title: 'Clientes', body: 'Comida fresca cerca de ti hasta 45 % más económica.', to: '/login?rol=cliente' },
  { icon: LineChart, title: 'Superadmin', body: 'Métricas globales de toda la red Reverde.', to: '/login?rol=superadmin' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo size="sm" />
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-ink-soft md:flex">
            <a href="#producto" className="transition-colors hover:text-brand-700">Producto</a>
            <a href="#como-funciona" className="transition-colors hover:text-brand-700">Cómo funciona</a>
            <a href="#impacto" className="transition-colors hover:text-brand-700">Impacto</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button to="/tienda" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Ver marketplace
            </Button>
            <Button to="/login" size="sm">Ingresar</Button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-100 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -left-32 top-40 h-96 w-96 rounded-full bg-brand-50 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-700">
                <Leaf className="h-3.5 w-3.5" />
                Una segunda oportunidad para los alimentos
              </span>
              <h1 className="mt-6 text-[40px] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[56px]">
                Menos desperdicio.
                <br />
                <span className="text-brand-700">Más valor recuperado.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
                Reverde detecta qué alimentos tienen riesgo de convertirse en desperdicio, ayuda al
                establecimiento a decidir qué hacer con ellos y los conecta con compradores para
                recuperar valor antes de perderlos.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button to="/login" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Entrar a la demo
                </Button>
                <Button to="/tienda" size="lg" variant="outline" icon={<ShoppingBag className="h-4 w-4" />}>
                  Explorar marketplace
                </Button>
              </div>
              <p className="mt-5 text-[12.5px] text-ink-faint">
                Prototipo universitario · Datos simulados · Contraseña demo <strong className="text-ink-soft">Demo1234</strong>
              </p>
            </div>

            {/* Mockup del dashboard */}
            <div className="animate-fade-up [animation-delay:120ms]">
              <div className="relative mx-auto max-w-md">
                <Card className="overflow-hidden p-0 shadow-lift">
                  <div className="flex items-center gap-2 border-b border-black/5 bg-white px-4 py-3">
                    <ReverdeMark className="h-6 w-6" />
                    <span className="text-[13px] font-bold text-ink">Alertas inteligentes</span>
                    <span className="ml-auto rounded-full bg-[#FCEDEC] px-2 py-0.5 text-[11px] font-bold text-[#B4453D]">
                      3 críticas
                    </span>
                  </div>
                  <div className="space-y-2.5 bg-canvas p-4">
                    {[
                      { emoji: '🥛', title: '24 yogures vencen en 2 días', body: 'Probabilidad de desperdicio: 87 %', tone: 'bg-[#FCEDEC] text-[#B4453D]', level: 'ALTO' },
                      { emoji: '🥑', title: '15 aguacates con baja rotación', body: 'Recomendamos crear un combo', tone: 'bg-[#FDF3E1] text-[#A9761A]', level: 'MEDIO' },
                      { emoji: '🥐', title: '32 croissants vencen mañana', body: 'Aplicar 40 % y publicar hoy', tone: 'bg-[#FCEDEC] text-[#B4453D]', level: 'ALTO' },
                    ].map((a) => (
                      <div key={a.title} className="flex items-start gap-3 rounded-xl border border-black/5 bg-white p-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg">
                          {a.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-bold text-ink">{a.title}</p>
                          <p className="truncate text-[11.5px] text-ink-soft">{a.body}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${a.tone}`}>
                          {a.level}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-xl bg-brand-700 p-3 text-white">
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <p className="text-[12px] leading-snug">
                        Un descuento del 30 % vendió el 82 % del inventario en promociones anteriores.
                      </p>
                    </div>
                  </div>
                </Card>
                <div className="absolute -bottom-5 -left-5 hidden animate-fade-up rounded-2xl bg-white p-3.5 shadow-lift [animation-delay:320ms] sm:block">
                  <p className="text-[11px] font-semibold text-ink-soft">Desperdicio evitado</p>
                  <p className="text-[22px] font-extrabold tracking-tight text-brand-700">86,4 kg</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Historia del producto ────────────────────────────────────── */}
      <section id="como-funciona" className="border-y border-black/5 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-brand-600">Cómo funciona</p>
            <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[38px]">
              Detecta, decide y recupera
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {FLOW.map((f, i) => (
              <div key={f.title} className="relative">
                <Card className="h-full p-6" hover>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-white">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-brand-500">Paso {i + 1}</p>
                  <h3 className="mt-1 text-[19px] font-bold text-ink">{f.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{f.body}</p>
                </Card>
                {i < FLOW.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-brand-300 sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tres pilares ─────────────────────────────────────────────── */}
      <section id="producto" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl space-y-6 px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-brand-600">Producto</p>
            <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[38px]">
              Tres piezas que trabajan juntas
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
              El inventario alimenta a la IA; la IA prioriza y recomienda; el marketplace convierte esa
              recomendación en valor recuperado.
            </p>
          </div>

          {PILLARS.map((p, i) => (
            <Card key={p.tag} className="overflow-hidden p-0" hover>
              <div className={`grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-2 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-[12px] font-bold text-brand-700">
                    <p.icon className="h-3.5 w-3.5" />
                    {p.tag}
                  </span>
                  <h3 className="mt-4 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{p.body}</p>
                  <ul className="mt-5 space-y-2.5">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-[14px] text-ink">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100">
                          <Leaf className="h-3 w-3 text-brand-700" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100">
                  <p.icon className="h-20 w-20 text-brand-400" strokeWidth={1.2} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Impacto ──────────────────────────────────────────────────── */}
      <section id="impacto" className="bg-brand-700 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-brand-300">Impacto</p>
            <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] sm:text-[38px]">
              Lo que un establecimiento deja de perder
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-brand-100">
              Promedio mensual de un supermercado de la red Reverde.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/[0.08] p-5 backdrop-blur">
                <s.icon className="h-5 w-5 text-brand-300" />
                <p className="mt-3 text-[28px] font-extrabold tracking-[-0.03em]">{s.value}</p>
                <p className="mt-1 text-[13px] leading-snug text-brand-100">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-brand-600">Demo</p>
            <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[38px]">
              Entra con el rol que quieras probar
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <Link key={r.title} to={r.to}>
                <Card className="group h-full p-5" hover>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                    <r.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[16px] font-bold text-ink">{r.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{r.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">
                    Entrar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <div>
            <Logo size="sm" showTagline />
            <p className="mt-3 text-[12.5px] text-ink-faint">
              Prototipo académico · Bogotá, Colombia · {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[13px] text-ink-soft">
            <Link to="/tienda/mapa" className="inline-flex items-center gap-1.5 hover:text-brand-700">
              <MapPin className="h-3.5 w-3.5" /> Reverde cerca de ti
            </Link>
            <Link to="/login" className="inline-flex items-center gap-1.5 hover:text-brand-700">
              Ingresar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
