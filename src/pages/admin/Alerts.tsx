import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellOff, CheckCircle2, ChevronRight, Percent, Sparkles, Upload } from 'lucide-react';
import { useEstablishmentData } from '../../hooks/useEstablishmentData';
import { useApp } from '../../store/AppContext';
import { computeRisk, finalPrice } from '../../lib/ai';
import { cop, cx, expiryLabel, relativeTime } from '../../lib/format';
import { Card, EmptyState, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { RiskBadge } from '../../components/ui/Badge';
import { Segmented } from '../../components/ui/Field';
import { CategoryRiskChart, ChartCard } from '../../components/charts/Charts';
import { riskByCategory } from '../../lib/metrics';

type Tab = 'todas' | 'alto' | 'medio';

export default function Alerts() {
  const { alerts, myProducts, scored } = useEstablishmentData();
  const { productById, applyRecommendation, dismissAlert, setPublished, toast, promoOutcomes } = useApp();
  const [tab, setTab] = useState<Tab>('todas');

  const visible = alerts.filter((a) => (tab === 'todas' ? true : a.level === tab));
  const high = alerts.filter((a) => a.level === 'alto').length;
  const medium = alerts.filter((a) => a.level === 'medio').length;
  const categories = riskByCategory(myProducts).slice(0, 6);
  const valueAtRisk = scored
    .filter((s) => s.risk.level === 'alto')
    .reduce((sum, s) => sum + finalPrice(s.product) * s.product.quantity, 0);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Alertas inteligentes"
        subtitle="Reverde prioriza los productos con mayor probabilidad de convertirse en desperdicio."
        action={
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'todas', label: `Todas (${alerts.length})` },
              { value: 'alto', label: `Alto (${high})` },
              { value: 'medio', label: `Medio (${medium})` },
            ]}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-3">
          {visible.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Sin alertas pendientes"
              description="Todo tu inventario está rotando a buen ritmo. Volveremos a avisarte si algo cambia."
              action={<Button size="sm" to="/app/inventario">Ir al inventario</Button>}
            />
          ) : (
            visible.map((alert) => {
              const product = productById(alert.productId);
              if (!product) return null;
              const risk = computeRisk(product);
              const rec = scored.find((s) => s.product.id === product.id)?.recommendation;
              const suggested = rec?.suggestedDiscount ?? 30;

              return (
                <Card key={alert.id} className={cx('overflow-hidden p-0', alert.level === 'alto' && 'border-[#F3C9C6]')}>
                  <div
                    className={cx(
                      'flex items-center gap-2 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide',
                      alert.level === 'alto' ? 'bg-[#FDF1F0] text-[#B4453D]' : 'bg-[#FDF8EE] text-[#A9761A]',
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {alert.level === 'alto' ? 'Alto riesgo' : 'Riesgo medio'}
                    <span className="ml-auto font-medium normal-case tracking-normal opacity-70">
                      {relativeTime(alert.createdAt)}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex gap-3.5">
                      <ProductThumb emoji={product.emoji} image={product.image} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold leading-snug text-ink">{alert.title}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{alert.body}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <RiskBadge level={risk.level} score={risk.score} size="sm" />
                          <span className="text-[12px] text-ink-faint">
                            {product.quantity} {product.unit}s · {cop(finalPrice(product))} · {expiryLabel(product.expiryDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        icon={<Percent className="h-3.5 w-3.5" />}
                        onClick={() => {
                          const msg = applyRecommendation(product.id, 'descuento', suggested);
                          toast({ title: 'Recomendación aplicada', description: msg });
                        }}
                      >
                        Aplicar {suggested} %
                      </Button>
                      {product.status !== 'publicado' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Upload className="h-3.5 w-3.5" />}
                          onClick={() => {
                            setPublished(product.id, true);
                            toast({ title: 'Publicado en el marketplace', description: product.name });
                          }}
                        >
                          Publicar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" to={`/app/alertas/${product.id}`} icon={<Sparkles className="h-3.5 w-3.5" />}>
                        Ver producto y análisis
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<BellOff className="h-3.5 w-3.5" />}
                        onClick={() => {
                          dismissAlert(product.id, 24);
                          toast({ title: 'Alerta pospuesta 24 horas', description: product.name, tone: 'info' });
                        }}
                      >
                        Ignorar por hoy
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          <Card className="bg-brand-700 p-5 text-white">
            <p className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-brand-200">
              <Sparkles className="h-3.5 w-3.5" /> Valor en riesgo
            </p>
            <p className="mt-2 text-[32px] font-extrabold tracking-[-0.03em]">{cop(valueAtRisk)}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-100">
              Es el valor del inventario en alto riesgo. Actuar hoy sobre estas {high} alerta
              {high === 1 ? '' : 's'} es lo que más impacto tiene.
            </p>
          </Card>

          <ChartCard title="Riesgo por categoría" subtitle="Risk Score promedio (0–100)">
            <CategoryRiskChart data={categories} />
          </ChartCard>

          <Card className="p-4">
            <p className="text-[13px] font-bold text-ink">Cómo aprende Reverde</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              El sistema guarda el resultado de cada promoción: qué descuento se aplicó, qué porcentaje del
              inventario se vendió y en cuántos días. Con {promoOutcomes.length} resultados registrados, las
              próximas recomendaciones se ajustan solas.
            </p>
            <Link
              to="/app/impacto"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline"
            >
              Ver impacto acumulado <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
