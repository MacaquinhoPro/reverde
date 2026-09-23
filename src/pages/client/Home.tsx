import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Leaf, MapPin, Search, Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useMarketplaceProducts } from '../../hooks/useMarketplace';
import { ESTABLISHMENTS } from '../../data/establishments';
import { CATEGORIES, CATEGORY_STYLE } from '../../data/catalog';
import { clientMetrics } from '../../lib/metrics';
import { cop, kg } from '../../lib/format';
import { ProductCard } from '../../components/ProductCard';
import { Card, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';

export default function ClientHome() {
  const { user, orders } = useApp();
  const all = useMarketplaceProducts({ sort: 'relevancia' });
  const urgent = useMarketplaceProducts({ expiringSoon: true, sort: 'vencimiento' }).slice(0, 4);
  const boxes = all.filter((p) => p.isRescueBox).slice(0, 4);
  const best = [...all].sort((a, b) => b.discountPercent - a.discountPercent).slice(0, 4);
  const metrics = user ? clientMetrics(orders, user.id) : null;
  const nearby = [...ESTABLISHMENTS].filter((e) => e.status === 'activo').sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-700 p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-600/60 blur-3xl" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold backdrop-blur">
            <Leaf className="h-3.5 w-3.5" /> {all.length} productos rescatables cerca de ti
          </span>
          <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[36px]">
            {user ? `Hola, ${user.name.split(' ')[0]}.` : 'Hola.'}
            <br />
            Rescata comida buena a mejor precio.
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-brand-100">
            Productos frescos de supermercados y restaurantes cercanos, con descuentos de hasta 50 % por estar
            próximos a vencer. Los rescatas tú, no la basura.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button to="/tienda/explorar" variant="secondary" icon={<Search className="h-4 w-4" />}>
              Explorar marketplace
            </Button>
            <Button to="/tienda/mapa" variant="light" icon={<MapPin className="h-4 w-4" />}>
              Reverde cerca de ti
            </Button>
          </div>
        </div>
      </section>

      {/* Impacto personal */}
      {metrics && metrics.orders > 0 && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="flex-1 text-[14.5px] leading-relaxed text-ink">
            Gracias a tus compras en Reverde has rescatado <strong>{metrics.rescued} productos</strong> y ayudado a
            evitar <strong>{kg(metrics.wasteAvoidedKg)}</strong> de desperdicio. Has ahorrado{' '}
            <strong className="text-brand-700">{cop(metrics.saved)}</strong>.
          </p>
          <Button to="/tienda/perfil" variant="outline" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
            Ver mi impacto
          </Button>
        </Card>
      )}

      {/* Categorías */}
      <section>
        <SectionTitle title="Explora por categoría" />
        <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to={`/tienda/explorar?categoria=${encodeURIComponent(c)}`}
              className="group flex shrink-0 items-center gap-2.5 rounded-2xl border border-black/5 bg-white p-2.5 pr-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${CATEGORY_STYLE[c].image}`}>
                {CATEGORY_STYLE[c].emoji}
              </span>
              <span className="text-[13px] font-semibold text-ink">{c}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Vencen pronto */}
      {urgent.length > 0 && (
        <section>
          <SectionTitle
            title="Rescátalos hoy"
            subtitle="Vencen en menos de 48 horas y están en perfecto estado."
            action={
              <Link to="/tienda/explorar?pronto=1" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {urgent.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Cajas de rescate */}
      {boxes.length > 0 && (
        <section>
          <SectionTitle title="Cajas de rescate" subtitle="Selección sorpresa a precio reducido. Máximo impacto, mínimo precio." />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {boxes.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Mejores descuentos */}
      <section>
        <SectionTitle
          title="Los mejores descuentos"
          action={
            <Link to="/tienda/explorar?orden=descuento" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {best.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Establecimientos cercanos */}
      <section>
        <SectionTitle title="Establecimientos cerca de ti" action={
          <Link to="/tienda/mapa" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Ver mapa <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        } />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {nearby.map((e) => {
            const count = all.filter((p) => p.establishmentId === e.id).length;
            return (
              <Link key={e.id} to={`/tienda/explorar?establecimiento=${e.id}`}>
                <Card className="h-full p-4" hover>
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-[15px] font-extrabold"
                    style={{ background: `hsl(${e.logoHue} 42% 92%)`, color: `hsl(${e.logoHue} 45% 28%)` }}
                  >
                    {e.name[0]}
                  </span>
                  <p className="mt-3 truncate text-[14px] font-bold text-ink">{e.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
                    <MapPin className="h-3 w-3" /> {e.distanceKm} km · {e.type}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[11.5px] font-semibold text-brand-700">
                    <Clock className="h-3 w-3" /> {count} producto{count === 1 ? '' : 's'} disponible{count === 1 ? '' : 's'}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
