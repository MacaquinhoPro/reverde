import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMarketplaceProducts, type MarketplaceFilters } from '../../hooks/useMarketplace';
import { ESTABLISHMENTS } from '../../data/establishments';
import { CATEGORIES } from '../../data/catalog';
import { cop, cx } from '../../lib/format';
import { ProductCard } from '../../components/ProductCard';
import { Card, EmptyState, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Field, SearchInput, Segmented, Select } from '../../components/ui/Field';
import { Drawer } from '../../components/ui/Modal';

type Sort = NonNullable<MarketplaceFilters['sort']>;

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(params.get('categoria') ?? 'todas');
  const [establishmentId, setEstablishmentId] = useState(params.get('establecimiento') ?? '');
  const [type, setType] = useState<'todos' | 'supermercado' | 'restaurante'>('todos');
  const [maxDistance, setMaxDistance] = useState(5);
  const [maxPrice, setMaxPrice] = useState(40000);
  const [minDiscount, setMinDiscount] = useState(0);
  const [expiringSoon, setExpiringSoon] = useState(params.get('pronto') === '1');
  const [sort, setSort] = useState<Sort>((params.get('orden') as Sort) ?? 'relevancia');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = useMemo<MarketplaceFilters>(
    () => ({
      query,
      category,
      establishmentId: establishmentId || undefined,
      establishmentType: type,
      maxDistance,
      maxPrice,
      minDiscount,
      expiringSoon,
      sort,
    }),
    [query, category, establishmentId, type, maxDistance, maxPrice, minDiscount, expiringSoon, sort],
  );

  const products = useMarketplaceProducts(filters);

  const activeCount = [
    category !== 'todas',
    !!establishmentId,
    type !== 'todos',
    maxDistance < 5,
    maxPrice < 40000,
    minDiscount > 0,
    expiringSoon,
  ].filter(Boolean).length;

  const reset = () => {
    setCategory('todas');
    setEstablishmentId('');
    setType('todos');
    setMaxDistance(5);
    setMaxPrice(40000);
    setMinDiscount(0);
    setExpiringSoon(false);
    setParams({});
  };

  const filterPanel = (
    <div className="space-y-5">
      <Field label="Categoría">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>

      <Field label="Tipo de establecimiento">
        <Segmented
          size="sm"
          className="w-full"
          value={type}
          onChange={setType}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'supermercado', label: 'Supermercados' },
            { value: 'restaurante', label: 'Restaurantes' },
          ]}
        />
      </Field>

      <Field label="Establecimiento">
        <Select value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)}>
          <option value="">Todos los establecimientos</option>
          {ESTABLISHMENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Field>

      <Field label={`Distancia máxima · ${maxDistance} km`}>
        <input type="range" min={0.5} max={5} step={0.5} value={maxDistance}
          onChange={(e) => setMaxDistance(+e.target.value)} className="w-full accent-brand-700" />
      </Field>

      <Field label={`Precio máximo · ${cop(maxPrice)}`}>
        <input type="range" min={2000} max={40000} step={1000} value={maxPrice}
          onChange={(e) => setMaxPrice(+e.target.value)} className="w-full accent-brand-700" />
      </Field>

      <Field label={`Descuento mínimo · ${minDiscount} %`}>
        <input type="range" min={0} max={50} step={5} value={minDiscount}
          onChange={(e) => setMinDiscount(+e.target.value)} className="w-full accent-brand-700" />
      </Field>

      <button
        onClick={() => setExpiringSoon((v) => !v)}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-xl border p-3.5 text-left text-[13.5px] font-semibold transition-all',
          expiringSoon ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-black/10 text-ink-soft hover:border-brand-300',
        )}
      >
        <Clock className="h-4 w-4" />
        Solo productos que vencen pronto
      </button>

      <Field label="Ordenar por">
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="relevancia">Relevancia</option>
          <option value="descuento">Mayor descuento</option>
          <option value="precio">Menor precio</option>
          <option value="distancia">Más cerca</option>
          <option value="vencimiento">Vence primero</option>
        </Select>
      </Field>
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Marketplace"
        subtitle="Productos rescatados de supermercados y restaurantes cercanos."
      />

      {/* Búsqueda + filtros */}
      <div className="sticky top-16 z-20 -mx-4 bg-canvas/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <SearchInput
            className="flex-1"
            placeholder="Buscar producto, categoría o establecimiento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            variant={activeCount ? 'secondary' : 'outline'}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden"
          >
            {activeCount || ''}
          </Button>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="hidden w-48 lg:block">
            <option value="relevancia">Relevancia</option>
            <option value="descuento">Mayor descuento</option>
            <option value="precio">Menor precio</option>
            <option value="distancia">Más cerca</option>
            <option value="vencimiento">Vence primero</option>
          </Select>
        </div>

        {/* Chips rápidos */}
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setExpiringSoon((v) => !v)}
            className={cx('chip shrink-0', expiringSoon ? 'bg-brand-700 text-white' : 'bg-white text-ink-soft ring-1 ring-black/5')}
          >
            <Clock className="h-3.5 w-3.5" /> Vence pronto
          </button>
          <button
            onClick={() => setMinDiscount(minDiscount >= 30 ? 0 : 30)}
            className={cx('chip shrink-0', minDiscount >= 30 ? 'bg-brand-700 text-white' : 'bg-white text-ink-soft ring-1 ring-black/5')}
          >
            30 % o más
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? 'todas' : c)}
              className={cx('chip shrink-0', category === c ? 'bg-brand-700 text-white' : 'bg-white text-ink-soft ring-1 ring-black/5')}
            >
              {c}
            </button>
          ))}
          {activeCount > 0 && (
            <button onClick={reset} className="chip shrink-0 bg-black/[0.04] text-ink-soft">
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        {/* Filtros (escritorio) */}
        <aside className="hidden lg:block">
          <Card className="sticky top-32 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-[14px] font-bold text-ink">
                <Filter className="h-4 w-4" /> Filtros
              </p>
              {activeCount > 0 && (
                <button onClick={reset} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
                  Limpiar
                </button>
              )}
            </div>
            {filterPanel}
          </Card>
        </aside>

        {/* Resultados */}
        <div>
          <p className="mb-3 text-[13px] text-ink-soft">
            <strong className="text-ink">{products.length}</strong> producto{products.length === 1 ? '' : 's'} disponible
            {products.length === 1 ? '' : 's'}
          </p>
          {products.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No encontramos productos"
              description="Prueba ampliando la distancia, subiendo el precio máximo o quitando filtros."
              action={<Button size="sm" onClick={reset}>Limpiar filtros</Button>}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>

      {/* Filtros (móvil) */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" block onClick={reset}>Limpiar</Button>
            <Button size="sm" block onClick={() => setFiltersOpen(false)}>Ver {products.length} productos</Button>
          </div>
        }
      >
        <div className="pb-2">{filterPanel}</div>
      </Drawer>
    </div>
  );
}
