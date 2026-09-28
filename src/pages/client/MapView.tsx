import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Star, Store, Utensils } from 'lucide-react';
import { ESTABLISHMENTS } from '../../data/establishments';
import { useMarketplaceProducts } from '../../hooks/useMarketplace';
import { finalPrice } from '../../lib/ai';
import { cop, cx } from '../../lib/format';
import { Card, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Segmented } from '../../components/ui/Field';
import { SimulatedMap } from '../../components/SimulatedMap';

type Filter = 'todos' | 'supermercado' | 'restaurante';

export default function MapView() {
  const products = useMarketplaceProducts({ sort: 'relevancia' });
  const [filter, setFilter] = useState<Filter>('todos');
  const [selected, setSelected] = useState<string>('sup-1');

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; avgDiscount: number; minPrice: number }>();
    ESTABLISHMENTS.forEach((e) => {
      const mine = products.filter((p) => p.establishmentId === e.id);
      map.set(e.id, {
        count: mine.length,
        avgDiscount: mine.length ? mine.reduce((s, p) => s + p.discountPercent, 0) / mine.length : 0,
        minPrice: mine.length ? Math.min(...mine.map(finalPrice)) : 0,
      });
    });
    return map;
  }, [products]);

  const visible = ESTABLISHMENTS.filter((e) => (filter === 'todos' ? true : e.type === filter));
  const current = ESTABLISHMENTS.find((e) => e.id === selected);
  const currentStats = stats.get(selected);
  const currentProducts = products.filter((p) => p.establishmentId === selected).slice(0, 3);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Reverde cerca de ti"
        subtitle="Supermercados y restaurantes con productos rescatables ahora mismo."
        action={
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'supermercado', label: 'Súper' },
              { value: 'restaurante', label: 'Restaurantes' },
            ]}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SimulatedMap
          establishments={visible}
          selectedId={selected}
          onSelect={setSelected}
          className="h-[340px] sm:h-[460px]"
        />

        <div className="space-y-3">
          {/* Detalle del seleccionado */}
          {current && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: `hsl(${current.logoHue} 42% 92%)`, color: `hsl(${current.logoHue} 45% 28%)` }}
                >
                  {current.type === 'supermercado' ? <Store className="h-5 w-5" /> : <Utensils className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[17px] font-extrabold tracking-tight text-ink">{current.name}</h3>
                    <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-ink-soft">
                      <Star className="h-3.5 w-3.5 fill-brand-400 text-brand-400" /> {current.rating}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-soft">
                    <MapPin className="h-3 w-3" /> {current.address} · {current.distanceKm} km
                  </p>
                  <p className="text-[12px] text-ink-faint">{current.schedule}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-canvas p-3 text-center">
                  <p className="text-[19px] font-extrabold text-ink">{currentStats?.count ?? 0}</p>
                  <p className="text-[11px] leading-tight text-ink-soft">productos</p>
                </div>
                <div className="rounded-xl bg-brand-50 p-3 text-center">
                  <p className="text-[19px] font-extrabold text-brand-700">
                    {Math.round(currentStats?.avgDiscount ?? 0)} %
                  </p>
                  <p className="text-[11px] leading-tight text-ink-soft">desc. promedio</p>
                </div>
                <div className="rounded-xl bg-canvas p-3 text-center">
                  <p className="text-[19px] font-extrabold text-ink">{cop(currentStats?.minPrice ?? 0)}</p>
                  <p className="text-[11px] leading-tight text-ink-soft">desde</p>
                </div>
              </div>

              {currentProducts.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {currentProducts.map((p) => (
                    <li key={p.id}>
                      <Link to={`/tienda/producto/${p.id}`} className="flex items-center gap-3 rounded-xl border border-black/5 p-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50/50">
                        <ProductThumb emoji={p.emoji} image={p.image} photo={p.photo} alt={p.name} size="xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                          <p className="text-[11.5px] text-ink-soft">
                            {cop(finalPrice(p))} <span className="text-ink-faint line-through">{cop(p.originalPrice)}</span>
                          </p>
                        </div>
                        <Badge tone="brand">−{p.discountPercent} %</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                block
                className="mt-4"
                to={`/tienda/explorar?establecimiento=${current.id}`}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Ver ofertas
              </Button>
            </Card>
          )}

          {/* Lista */}
          <Card className="p-2">
            <ul className="divide-y divide-black/5">
              {visible.map((e) => {
                const s = stats.get(e.id);
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => setSelected(e.id)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors',
                        selected === e.id ? 'bg-brand-50' : 'hover:bg-black/[0.02]',
                      )}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
                        style={{ background: `hsl(${e.logoHue} 42% 92%)`, color: `hsl(${e.logoHue} 45% 28%)` }}
                      >
                        {e.name[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold text-ink">{e.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-soft">
                          {e.distanceKm} km · {s?.count ?? 0} productos · −{Math.round(s?.avgDiscount ?? 0)} % promedio
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
