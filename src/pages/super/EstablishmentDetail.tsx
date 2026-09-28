import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Leaf, MapPin, PackageCheck, ShoppingBag, Star, Wallet } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { byEstablishment, ESTABLISHMENTS } from '../../data/establishments';
import { aggregate, inventoryStats, salesInLastDays, weeklySeries } from '../../lib/metrics';
import { computeRisk, finalPrice } from '../../lib/ai';
import { cop, expiryLabel, formatDate, kg, qtyLabel } from '../../lib/format';
import { Card, EmptyState, KpiCard, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, RiskBadge } from '../../components/ui/Badge';
import { AreaTrend, BarTrend, ChartCard, RiskDistribution } from '../../components/charts/Charts';
import { SimulatedMap } from '../../components/SimulatedMap';

export default function EstablishmentDetail() {
  const { id } = useParams();
  const { products, sales } = useApp();
  const est = byEstablishment(id);

  if (!est) {
    return (
      <EmptyState
        title="Establecimiento no encontrado"
        action={<Button size="sm" to="/admin/establecimientos">Volver al listado</Button>}
      />
    );
  }

  const myProducts = products.filter((p) => p.establishmentId === est.id);
  const mySales = sales.filter((s) => s.establishmentId === est.id);
  const month = aggregate(salesInLastDays(mySales, 30));
  const stats = inventoryStats(myProducts);
  const series = weeklySeries(mySales);
  const published = myProducts.filter((p) => p.status === 'publicado');

  return (
    <div className="space-y-5">
      <Button to="/admin/establecimientos" variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
        Establecimientos
      </Button>

      {/* Cabecera */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[20px] font-extrabold"
            style={{ background: `hsl(${est.logoHue} 42% 92%)`, color: `hsl(${est.logoHue} 45% 28%)` }}
          >
            {est.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-extrabold tracking-[-0.025em] text-ink">{est.name}</h1>
              <Badge tone={est.status === 'activo' ? 'green' : 'amber'}>{est.status}</Badge>
              <Badge tone="neutral">{est.type}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-soft">
              <MapPin className="h-3.5 w-3.5" /> {est.address}, {est.city} · {est.distanceKm} km
            </p>
            <p className="text-[12.5px] text-ink-faint">
              {est.schedule} · En Reverde desde {formatDate(est.joinedAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-canvas px-3 py-2">
            <Star className="h-4 w-4 fill-brand-400 text-brand-400" />
            <span className="text-[15px] font-extrabold text-ink">{est.rating}</span>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Productos rescatados" value={String(month.rescued)} icon={<PackageCheck className="h-4 w-4" />} tone="brand" hint="últimos 30 días" />
        <KpiCard label="Desperdicio evitado" value={month.wasteAvoidedKg.toFixed(1).replace('.', ',')} unit="kg" icon={<Leaf className="h-4 w-4" />} />
        <KpiCard label="Dinero recuperado" value={cop(month.recovered)} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Publicados ahora" value={String(published.length)} icon={<ShoppingBag className="h-4 w-4" />} hint={`de ${stats.total} en inventario`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Desperdicio evitado" subtitle="Kilogramos por semana">
          <AreaTrend data={series} dataKey="wasteAvoidedKg" formatter={(v) => kg(v)} />
        </ChartCard>
        <ChartCard title="Dinero recuperado" subtitle="Ingresos por semana">
          <BarTrend data={series} dataKey="recovered" formatter={(v) => cop(v)} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-4 sm:p-5">
          <SectionTitle title="Inventario por nivel de riesgo" subtitle={`${stats.total} productos`} />
          <div className="mt-4">
            <RiskDistribution low={stats.low} medium={stats.medium} high={stats.high} />
          </div>
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="p-4 sm:p-5">
            <SectionTitle title="Ubicación" subtitle={`${est.address}, ${est.city}`} />
          </div>
          <SimulatedMap
            establishments={ESTABLISHMENTS.filter((e) => e.id === est.id)}
            highlightId={est.id}
            compact
            className="h-48 rounded-none border-0 border-t border-black/5"
          />
        </Card>
      </div>

      {/* Publicaciones */}
      <Card className="p-4 sm:p-5">
        <SectionTitle title="Publicaciones activas" subtitle="Supervisión de lo que este establecimiento ofrece en el marketplace." />
        {published.length === 0 ? (
          <p className="mt-4 rounded-xl bg-canvas p-4 text-[13px] text-ink-soft">
            Este establecimiento no tiene publicaciones activas en este momento.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {published.map((p) => {
              const r = computeRisk(p);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-black/5 p-3">
                  <ProductThumb emoji={p.emoji} image={p.image} photo={p.photo} alt={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/tienda/producto/${p.id}`} className="truncate text-[13.5px] font-bold text-ink hover:text-brand-700">
                      {p.name}
                    </Link>
                    <p className="truncate text-[12px] text-ink-soft">
                      {qtyLabel(p.quantity, p.unit)} · {expiryLabel(p.expiryDate)} · −{p.discountPercent} %
                    </p>
                  </div>
                  <span className="shrink-0 text-[13.5px] font-extrabold text-brand-700">{cop(finalPrice(p))}</span>
                  <RiskBadge level={r.level} score={r.score} size="sm" showScore={false} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
