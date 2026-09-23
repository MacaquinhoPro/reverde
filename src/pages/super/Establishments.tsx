import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Store, Utensils } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { ESTABLISHMENTS } from '../../data/establishments';
import { aggregate, salesInLastDays } from '../../lib/metrics';
import { cop, formatDateShort, kg } from '../../lib/format';
import { Card, EmptyState, SectionTitle } from '../../components/ui/Primitives';
import { Badge } from '../../components/ui/Badge';
import { SearchInput, Segmented } from '../../components/ui/Field';

type Filter = 'todos' | 'supermercado' | 'restaurante';

export default function Establishments() {
  const { products, sales } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const rows = useMemo(() => {
    return ESTABLISHMENTS.filter((e) => (filter === 'todos' ? true : e.type === filter))
      .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
      .map((est) => {
        const m = aggregate(salesInLastDays(sales.filter((s) => s.establishmentId === est.id), 30));
        return {
          est,
          published: products.filter((p) => p.establishmentId === est.id && p.status === 'publicado').length,
          inventory: products.filter((p) => p.establishmentId === est.id).length,
          ...m,
        };
      })
      .sort((a, b) => b.recovered - a.recovered);
  }, [products, sales, query, filter]);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Establecimientos"
        subtitle="Supermercados y restaurantes que usan Reverde."
        action={
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'supermercado', label: 'Supermercados' },
              { value: 'restaurante', label: 'Restaurantes' },
            ]}
          />
        }
      />

      <Card className="p-3 sm:p-4">
        <SearchInput placeholder="Buscar establecimiento…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<Building2 className="h-5 w-5" />} title="Sin resultados" description="Ajusta la búsqueda o los filtros." />
      ) : (
        <>
          {/* Tabla */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/5 bg-canvas/60 text-[11.5px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Establecimiento</th>
                  <th className="px-3 py-3 font-semibold">Estado</th>
                  <th className="px-3 py-3 font-semibold">Publicados</th>
                  <th className="px-3 py-3 font-semibold">Ventas (30 d)</th>
                  <th className="px-3 py-3 font-semibold">Desperdicio evitado</th>
                  <th className="px-3 py-3 font-semibold">Recuperado</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((r) => (
                  <tr key={r.est.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <Link to={`/admin/establecimientos/${r.est.id}`} className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `hsl(${r.est.logoHue} 42% 92%)`, color: `hsl(${r.est.logoHue} 45% 28%)` }}
                        >
                          {r.est.type === 'supermercado' ? <Store className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-bold text-ink hover:text-brand-700">{r.est.name}</span>
                          <span className="block truncate text-[11.5px] text-ink-faint">{r.est.address}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={r.est.status === 'activo' ? 'green' : r.est.status === 'pendiente' ? 'amber' : 'red'}>
                        {r.est.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-ink">
                      {r.published} <span className="text-ink-faint">/ {r.inventory}</span>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-ink">{r.orders}</td>
                    <td className="px-3 py-3 text-[13px] text-ink">{kg(r.wasteAvoidedKg)}</td>
                    <td className="px-3 py-3 text-[13px] font-bold text-brand-700">{cop(r.recovered)}</td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-soft">{formatDateShort(r.est.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Tarjetas */}
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((r) => (
              <Link key={r.est.id} to={`/admin/establecimientos/${r.est.id}`}>
                <Card className="h-full p-4" hover>
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `hsl(${r.est.logoHue} 42% 92%)`, color: `hsl(${r.est.logoHue} 45% 28%)` }}
                    >
                      {r.est.type === 'supermercado' ? <Store className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-ink">{r.est.name}</p>
                      <p className="truncate text-[12px] text-ink-soft">{r.est.address}</p>
                    </div>
                    <Badge tone={r.est.status === 'activo' ? 'green' : 'amber'}>{r.est.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 pt-3 text-center">
                    <div>
                      <p className="text-[15px] font-extrabold text-ink">{r.published}</p>
                      <p className="text-[10.5px] text-ink-soft">publicados</p>
                    </div>
                    <div>
                      <p className="text-[15px] font-extrabold text-ink">{kg(r.wasteAvoidedKg)}</p>
                      <p className="text-[10.5px] text-ink-soft">evitados</p>
                    </div>
                    <div>
                      <p className="text-[15px] font-extrabold text-brand-700">{cop(r.recovered)}</p>
                      <p className="text-[10.5px] text-ink-soft">recuperado</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
