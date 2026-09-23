import { useState } from 'react';
import { Droplets, Leaf, PackageCheck, Recycle, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useEstablishmentData } from '../../hooks/useEstablishmentData';
import { aggregate, co2FromKg, monthOverMonth, salesInLastDays, waterFromKg, weeklySeries } from '../../lib/metrics';
import { cop, kg, pct } from '../../lib/format';
import { Card, KpiCard, ProgressBar, SectionTitle } from '../../components/ui/Primitives';
import { Segmented } from '../../components/ui/Field';
import { AreaTrend, BarTrend, ChartCard, LineTrend } from '../../components/charts/Charts';

type Range = '7' | '30' | '90';

export default function Impact() {
  const { mySales, establishment } = useEstablishmentData();
  const [range, setRange] = useState<Range>('30');

  const periodSales = salesInLastDays(mySales, +range);
  const totals = aggregate(periodSales);
  const mom = monthOverMonth(mySales);
  const series = weeklySeries(mySales);
  const marketplaceShare = totals.orders ? (totals.marketplaceSales / totals.orders) * 100 : 0;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Impacto de Reverde"
        subtitle={`Cuánto desperdicio está evitando ${establishment?.name ?? 'tu establecimiento'} y cuánto dinero deja de perder.`}
        action={
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 días' },
              { value: '30', label: '30 días' },
              { value: '90', label: '90 días' },
            ]}
          />
        }
      />

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard
          label="Desperdicio evitado"
          value={totals.wasteAvoidedKg.toFixed(1).replace('.', ',')}
          unit="kg"
          delta={range === '30' ? mom.wasteDelta : undefined}
          icon={<Leaf className="h-4 w-4" />}
          tone="brand"
        />
        <KpiCard
          label="Pérdidas evitadas"
          value={cop(totals.lossesAvoided)}
          delta={range === '30' ? mom.lossesDelta : undefined}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KpiCard
          label="Ingresos recuperados"
          value={cop(totals.recovered)}
          delta={range === '30' ? mom.recoveredDelta : undefined}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Productos rescatados"
          value={String(totals.rescued)}
          delta={range === '30' ? mom.rescuedDelta : undefined}
          icon={<PackageCheck className="h-4 w-4" />}
        />
        <KpiCard
          label="Tasa de recuperación"
          value={pct(totals.recoveryRate)}
          icon={<Recycle className="h-4 w-4" />}
          hint="del valor en riesgo"
        />
      </div>

      {/* Comparaciones */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-start gap-3.5 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF6EF] text-risk-low">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-ink">
              {mom.rescuedDelta >= 0 ? '+' : ''}{Math.round(mom.rescuedDelta)} % de alimentos recuperados
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              frente al mes anterior. Pasaste de {mom.previous.rescued} a {mom.current.rescued} productos rescatados.
            </p>
          </div>
        </Card>
        <Card className="flex items-start gap-3.5 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-ink">
              {mom.extraRecovered >= 0 ? 'Recuperaste' : 'Dejaste de recuperar'} {cop(Math.abs(mom.extraRecovered))} adicionales
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              Este mes {mom.extraRecovered >= 0 ? 'evitaste perder' : 'perdiste'} aproximadamente esa cifra frente al mes anterior.
            </p>
          </div>
        </Card>
      </div>

      {/* Gráficas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Desperdicio evitado por semana" subtitle="Kilogramos de alimento rescatado">
          <AreaTrend data={series} dataKey="wasteAvoidedKg" formatter={(v) => kg(v)} />
        </ChartCard>
        <ChartCard title="Dinero recuperado" subtitle="Ingresos por semana a través de Reverde">
          <BarTrend data={series} dataKey="recovered" formatter={(v) => cop(v)} />
        </ChartCard>
        <ChartCard title="Productos rescatados" subtitle="Unidades vendidas antes de vencer">
          <LineTrend data={series} dataKey="rescued" unit="und" />
        </ChartCard>
        <ChartCard title="Ventas mediante marketplace" subtitle="Unidades vendidas por el canal Reverde">
          <BarTrend data={series} dataKey="marketplace" unit="und" />
        </ChartCard>
      </div>

      {/* Impacto ambiental + canal */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-4 sm:p-5">
          <SectionTitle title="Impacto ambiental estimado" subtitle={`Equivalencias de ${kg(totals.wasteAvoidedKg)} de alimento rescatado`} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-50 p-4">
              <Leaf className="h-5 w-5 text-brand-700" />
              <p className="mt-2.5 text-[24px] font-extrabold tracking-tight text-brand-700">
                {co2FromKg(totals.wasteAvoidedKg).toLocaleString('es-CO')} kg
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">de CO₂e que no se emitieron</p>
            </div>
            <div className="rounded-2xl bg-[#F1F6FC] p-4">
              <Droplets className="h-5 w-5 text-[#3B6EA5]" />
              <p className="mt-2.5 text-[24px] font-extrabold tracking-tight text-[#3B6EA5]">
                {waterFromKg(totals.wasteAvoidedKg).toLocaleString('es-CO')} L
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">de agua ahorrada en la cadena productiva</p>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            Estimaciones basadas en promedios del sector (2,5 kg CO₂e y 1.000 L de agua por kilo de alimento).
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle title="Canal de recuperación" subtitle="Cómo se están rescatando los productos" />
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">Marketplace Reverde</span>
                <span className="font-bold text-ink">{pct(marketplaceShare)}</span>
              </div>
              <ProgressBar value={marketplaceShare} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">Venta presencial y donación</span>
                <span className="font-bold text-ink">{pct(100 - marketplaceShare)}</span>
              </div>
              <ProgressBar value={100 - marketplaceShare} tone="green" />
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-brand-700 p-4 text-white">
            <p className="text-[12.5px] text-brand-100">Valor promedio recuperado por producto</p>
            <p className="mt-1 text-[26px] font-extrabold tracking-tight">
              {cop(totals.rescued ? totals.recovered / totals.rescued : 0)}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
