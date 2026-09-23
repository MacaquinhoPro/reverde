import { useMemo, useState } from 'react';
import { Download, Leaf, Receipt, Wallet } from 'lucide-react';
import { useEstablishmentData } from '../../hooks/useEstablishmentData';
import { aggregate, salesInLastDays } from '../../lib/metrics';
import { cop, formatDateTime, kg } from '../../lib/format';
import { Card, EmptyState, KpiCard, SectionTitle } from '../../components/ui/Primitives';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SearchInput, Segmented, Select } from '../../components/ui/Field';

type Range = '1' | '7' | '30' | '90';

export default function Sales() {
  const { mySales } = useEstablishmentData();
  const [range, setRange] = useState<Range>('7');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('todos');

  const rows = useMemo(() => {
    let list = salesInLastDays(mySales, +range);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.productName.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q));
    }
    if (channel !== 'todos') list = list.filter((s) => s.channel === channel);
    return list.slice(0, 120);
  }, [mySales, range, query, channel]);

  const totals = aggregate(rows);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Historial de ventas"
        subtitle="Cada venta a través de Reverde es un producto que no terminó en la basura."
        action={
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={() => window.print()}
          >
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Ventas registradas" value={String(rows.length)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Dinero recuperado" value={cop(totals.recovered)} icon={<Wallet className="h-4 w-4" />} tone="brand" />
        <KpiCard label="Desperdicio evitado" value={totals.wasteAvoidedKg.toFixed(1).replace('.', ',')} unit="kg" icon={<Leaf className="h-4 w-4" />} />
        <KpiCard label="Unidades rescatadas" value={String(totals.rescued)} icon={<Leaf className="h-4 w-4" />} />
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            className="flex-1"
            placeholder="Buscar por producto o cliente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '1', label: 'Hoy' },
              { value: '7', label: 'Semana' },
              { value: '30', label: 'Mes' },
              { value: '90', label: '90 días' },
            ]}
          />
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full py-2 text-[13px] lg:w-44">
            <option value="todos">Todos los canales</option>
            <option value="marketplace">Marketplace</option>
            <option value="tienda">Tienda / donación</option>
          </Select>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-5 w-5" />}
          title="Sin ventas en este periodo"
          description="Cambia el rango de fechas o los filtros para ver más resultados."
        />
      ) : (
        <>
          {/* Tabla (escritorio) */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/5 bg-canvas/60 text-[11.5px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-3 py-3 font-semibold">Producto</th>
                  <th className="px-3 py-3 font-semibold">Cliente</th>
                  <th className="px-3 py-3 font-semibold">Cant.</th>
                  <th className="px-3 py-3 font-semibold">P. original</th>
                  <th className="px-3 py-3 font-semibold">P. vendido</th>
                  <th className="px-3 py-3 font-semibold">Desc.</th>
                  <th className="px-3 py-3 font-semibold">Recuperado</th>
                  <th className="px-4 py-3 font-semibold">Desp. evitado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink-soft">{formatDateTime(s.date)}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-base">{s.emoji}</span>
                        <span className="text-[13px] font-semibold text-ink">{s.productName}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">{s.customer}</td>
                    <td className="px-3 py-3 text-[13px] text-ink">{s.qty}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-faint line-through">{cop(s.originalPrice)}</td>
                    <td className="px-3 py-3 text-[13px] font-semibold text-ink">{cop(s.soldPrice)}</td>
                    <td className="px-3 py-3">
                      <Badge tone="brand">−{s.discountPercent} %</Badge>
                    </td>
                    <td className="px-3 py-3 text-[13px] font-bold text-brand-700">{cop(s.recovered)}</td>
                    <td className="px-4 py-3 text-[12.5px] text-ink">{kg(s.wasteAvoidedKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Tarjetas (móvil) */}
          <div className="space-y-2.5 lg:hidden">
            {rows.map((s) => (
              <Card key={s.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">
                    {s.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[14px] font-bold text-ink">{s.productName}</p>
                      <Badge tone="brand">−{s.discountPercent} %</Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-soft">
                      {s.customer} · {formatDateTime(s.date)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                      <span className="text-ink">
                        {s.qty} und × <strong>{cop(s.soldPrice)}</strong>
                      </span>
                      <span className="text-ink-faint line-through">{cop(s.originalPrice)}</span>
                      <span className="font-bold text-brand-700">{cop(s.recovered)}</span>
                      <span className="text-ink-soft">· {kg(s.wasteAvoidedKg)} evitados</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
