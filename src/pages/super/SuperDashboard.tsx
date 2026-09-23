import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Leaf, PackageCheck, ShoppingBag, Store, Users, Utensils, Wallet } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { ESTABLISHMENTS } from '../../data/establishments';
import { USERS } from '../../data/users';
import { aggregate, monthOverMonth, salesInLastDays, weeklySeries } from '../../lib/metrics';
import { cop, copCompact, kg } from '../../lib/format';
import { Card, KpiCard, ProgressBar, SectionTitle } from '../../components/ui/Primitives';
import { Badge } from '../../components/ui/Badge';
import { AreaTrend, BarTrend, ChartCard, LineTrend } from '../../components/charts/Charts';

export default function SuperDashboard() {
  const { products, sales } = useApp();

  const month = aggregate(salesInLastDays(sales, 30));
  const mom = monthOverMonth(sales);
  const series = weeklySeries(sales);
  const published = products.filter((p) => p.status === 'publicado');
  const clients = USERS.filter((u) => u.role === 'cliente').length;
  const supermarkets = ESTABLISHMENTS.filter((e) => e.type === 'supermercado');
  const restaurants = ESTABLISHMENTS.filter((e) => e.type === 'restaurante');

  const ranking = [...ESTABLISHMENTS]
    .map((e) => {
      const m = aggregate(salesInLastDays(sales.filter((s) => s.establishmentId === e.id), 30));
      return { est: e, ...m };
    })
    .sort((a, b) => b.recovered - a.recovered);
  const maxRecovered = Math.max(...ranking.map((r) => r.recovered), 1);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Panel global de Reverde"
        subtitle="Estado de toda la red: establecimientos, publicaciones, ventas e impacto."
      />

      {/* Red */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Establecimientos registrados" value={String(ESTABLISHMENTS.length)} icon={<Building2 className="h-4 w-4" />} hint={`${ESTABLISHMENTS.filter((e) => e.status === 'activo').length} activos`} />
        <KpiCard label="Supermercados" value={String(supermarkets.length)} icon={<Store className="h-4 w-4" />} />
        <KpiCard label="Restaurantes" value={String(restaurants.length)} icon={<Utensils className="h-4 w-4" />} />
        <KpiCard label="Clientes registrados" value={String(clients)} icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Impacto global */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Productos rescatados"
          value={String(month.rescued)}
          delta={mom.rescuedDelta}
          icon={<PackageCheck className="h-4 w-4" />}
          tone="brand"
          hint="últimos 30 días"
        />
        <KpiCard
          label="Desperdicio evitado global"
          value={month.wasteAvoidedKg.toFixed(1).replace('.', ',')}
          unit="kg"
          delta={mom.wasteDelta}
          icon={<Leaf className="h-4 w-4" />}
        />
        <KpiCard
          label="Dinero recuperado global"
          value={copCompact(month.recovered)}
          delta={mom.recoveredDelta}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Productos publicados"
          value={String(published.length)}
          icon={<ShoppingBag className="h-4 w-4" />}
          hint={`de ${products.length} en inventario`}
        />
      </div>

      {/* Gráficas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Desperdicio evitado en la red" subtitle="Kilogramos por semana">
          <AreaTrend data={series} dataKey="wasteAvoidedKg" formatter={(v) => kg(v)} />
        </ChartCard>
        <ChartCard title="Dinero recuperado en la red" subtitle="Ingresos por semana">
          <BarTrend data={series} dataKey="recovered" formatter={(v) => cop(v)} />
        </ChartCard>
        <ChartCard title="Productos rescatados" subtitle="Unidades por semana">
          <LineTrend data={series} dataKey="rescued" unit="und" />
        </ChartCard>
        <ChartCard title="Ventas mediante marketplace" subtitle="Unidades por semana">
          <BarTrend data={series} dataKey="marketplace" unit="und" />
        </ChartCard>
      </div>

      {/* Ranking */}
      <Card className="p-4 sm:p-5">
        <SectionTitle
          title="Ranking de establecimientos"
          subtitle="Dinero recuperado en los últimos 30 días"
          action={
            <Link to="/admin/establecimientos" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <ul className="mt-4 space-y-3">
          {ranking.map((r, i) => (
            <li key={r.est.id}>
              <Link to={`/admin/establecimientos/${r.est.id}`} className="block rounded-xl p-2 transition-colors hover:bg-brand-50/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[12px] font-extrabold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-bold text-ink">{r.est.name}</span>
                      <Badge tone={r.est.status === 'activo' ? 'green' : 'amber'}>{r.est.status}</Badge>
                    </span>
                    <span className="block text-[11.5px] text-ink-soft">
                      {r.rescued} productos · {kg(r.wasteAvoidedKg)} evitados
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-extrabold text-brand-700">{cop(r.recovered)}</span>
                </div>
                <ProgressBar value={(r.recovered / maxRecovered) * 100} className="mt-2 h-1.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
