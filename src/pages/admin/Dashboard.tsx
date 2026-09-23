import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  Leaf,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useEstablishmentData } from '../../hooks/useEstablishmentData';
import { useApp } from '../../store/AppContext';
import { aggregate, inventoryStats, monthOverMonth, riskByCategory, salesInLastDays, weeklySeries } from '../../lib/metrics';
import { finalPrice } from '../../lib/ai';
import { cop, copCompact, expiryLabel, kg } from '../../lib/format';
import { Card, KpiCard, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { RiskBadge } from '../../components/ui/Badge';
import { AreaTrend, BarTrend, ChartCard, LineTrend, RiskDistribution } from '../../components/charts/Charts';

export default function AdminDashboard() {
  const { user } = useApp();
  const { establishment, myProducts, mySales, scored, alerts } = useEstablishmentData();

  const stats = inventoryStats(myProducts);
  const month = aggregate(salesInLastDays(mySales, 30));
  const mom = monthOverMonth(mySales);
  const series = weeklySeries(mySales);
  const categories = riskByCategory(myProducts).slice(0, 5);
  const priority = scored.filter((s) => s.risk.level !== 'bajo' && s.product.quantity > 0).slice(0, 5);
  const highAlerts = alerts.filter((a) => a.level === 'alto').length;

  return (
    <div className="space-y-6">
      {/* Saludo + acciones */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-ink-soft">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-ink sm:text-[30px]">
            Hola, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {establishment?.name} · {stats.high} producto{stats.high === 1 ? '' : 's'} necesita
            {stats.high === 1 ? '' : 'n'} tu atención hoy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button to="/app/inventario" variant="outline" size="sm" icon={<Boxes className="h-4 w-4" />}>
            Inventario
          </Button>
          <Button to="/app/alertas" size="sm" icon={<Sparkles className="h-4 w-4" />}>
            Ver alertas IA
          </Button>
        </div>
      </header>

      {/* Alerta destacada */}
      {highAlerts > 0 && (
        <Link to="/app/alertas" className="block">
          <Card className="flex items-center gap-4 border-[#F3C9C6] bg-[#FDF1F0] p-4 transition-all hover:shadow-lift sm:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#B4453D]">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-ink">
                {highAlerts} alerta{highAlerts === 1 ? '' : 's'} de alto riesgo sin resolver
              </p>
              <p className="mt-0.5 truncate text-[13px] text-ink-soft">
                Hay {cop(stats.valueAtRisk)} en inventario que podría perderse esta semana.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#B4453D]" />
          </Card>
        </Link>
      )}

      {/* KPIs principales */}
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
          label="Desperdicio evitado"
          value={month.wasteAvoidedKg.toFixed(1).replace('.', ',')}
          unit="kg"
          delta={mom.wasteDelta}
          icon={<Leaf className="h-4 w-4" />}
        />
        <KpiCard
          label="Pérdidas evitadas"
          value={copCompact(month.lossesAvoided)}
          delta={mom.lossesDelta}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KpiCard
          label="Ingresos recuperados"
          value={copCompact(month.recovered)}
          delta={mom.recoveredDelta}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      {/* KPIs de inventario */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Productos en inventario" value={String(stats.total)} unit={`· ${stats.units} und`} icon={<Boxes className="h-4 w-4" />} />
        <KpiCard label="Productos en alto riesgo" value={String(stats.high)} tone="red" icon={<AlertTriangle className="h-4 w-4" />} hint={`${cop(stats.valueAtRisk)} en riesgo`} />
        <KpiCard label="Próximos a vencer (3 días)" value={String(stats.expiringSoon)} tone="amber" icon={<CalendarClock className="h-4 w-4" />} />
        <KpiCard label="Publicados en marketplace" value={String(stats.published)} icon={<ShoppingBag className="h-4 w-4" />} hint={`de ${stats.total} productos`} />
      </div>

      {/* Gráficas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Desperdicio evitado por semana" subtitle="Kilogramos rescatados en las últimas 8 semanas">
          <AreaTrend data={series} dataKey="wasteAvoidedKg" formatter={(v) => kg(v)} />
        </ChartCard>
        <ChartCard title="Dinero recuperado por semana" subtitle="Ingresos generados a través de Reverde">
          <BarTrend data={series} dataKey="recovered" formatter={(v) => cop(v)} />
        </ChartCard>
        <ChartCard title="Productos rescatados" subtitle="Unidades vendidas antes de vencer">
          <LineTrend data={series} dataKey="rescued" unit="und" />
        </ChartCard>
        <ChartCard title="Ventas mediante marketplace" subtitle="Unidades vendidas por el canal Reverde">
          <BarTrend data={series} dataKey="marketplace" unit="und" />
        </ChartCard>
      </div>

      {/* Priorización */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-4 sm:p-5">
          <SectionTitle
            title="Prioriza hoy"
            subtitle="Productos con mayor riesgo de convertirse en desperdicio"
            action={
              <Link to="/app/alertas" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                Ver todas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <ul className="mt-4 space-y-2">
            {priority.map(({ product, risk }) => (
              <li key={product.id}>
                <Link
                  to={`/app/alertas/${product.id}`}
                  className="flex items-center gap-3 rounded-xl border border-black/5 p-3 transition-all hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <ProductThumb emoji={product.emoji} image={product.image} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink">{product.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                      {product.quantity} {product.unit}s · {expiryLabel(product.expiryDate)} · {cop(finalPrice(product))}
                    </p>
                  </div>
                  <RiskBadge level={risk.level} score={risk.score} size="sm" />
                </Link>
              </li>
            ))}
            {priority.length === 0 && (
              <li className="rounded-xl bg-brand-50 p-4 text-[13px] text-brand-700">
                Ningún producto en riesgo medio o alto. Todo bajo control.
              </li>
            )}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <SectionTitle title="Distribución de riesgo" subtitle={`${stats.total} productos en inventario`} />
            <div className="mt-4">
              <RiskDistribution low={stats.low} medium={stats.medium} high={stats.high} />
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Categorías con más riesgo" subtitle="Risk Score promedio" />
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c.category} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{c.category}</span>
                  <span className="text-[12px] text-ink-faint">{c.items} prod.</span>
                  <RiskBadge
                    level={c.score >= 70 ? 'alto' : c.score >= 40 ? 'medio' : 'bajo'}
                    score={c.score}
                    size="sm"
                    showScore
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
