import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, CalendarClock, Store, TrendingDown, Upload } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { AiRecommendationPanel, RiskExplainer, useProductAi } from '../../components/AiRecommendation';
import { Card, EmptyState, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, DiscountTag, RiskBadge } from '../../components/ui/Badge';
import { finalPrice, learnFromHistory, productWeightKg } from '../../lib/ai';
import { byEstablishment } from '../../data/establishments';
import { cop, expiryLabel, formatDate, kg } from '../../lib/format';
import type { Product } from '../../types';

function Detail({ product }: { product: Product }) {
  const { risk } = useProductAi(product);
  const { setPublished, toast, promoOutcomes } = useApp();
  const est = byEstablishment(product.establishmentId);
  const learned = learnFromHistory(product.category, promoOutcomes);
  const potentialLoss = finalPrice(product) * product.quantity;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button to="/app/alertas" variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
          Alertas
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* Columna principal */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <ProductThumb emoji={product.emoji} image={product.image} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={risk.level} score={risk.score} />
                  <Badge tone={product.status === 'publicado' ? 'brand' : 'neutral'}>
                    {product.status === 'publicado' ? 'Publicado en marketplace' : 'Solo en inventario'}
                  </Badge>
                  <DiscountTag percent={product.discountPercent} />
                </div>
                <h1 className="mt-2.5 text-[24px] font-extrabold tracking-[-0.025em] text-ink">{product.name}</h1>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{product.description}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
                  <Store className="h-3.5 w-3.5" /> {est?.name}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Boxes, label: 'Stock', value: `${product.quantity} ${product.unit}s` },
                { icon: CalendarClock, label: 'Vence', value: formatDate(product.expiryDate), hint: expiryLabel(product.expiryDate) },
                { icon: TrendingDown, label: 'Precio Reverde', value: cop(finalPrice(product)), hint: product.discountPercent > 0 ? `antes ${cop(product.originalPrice)}` : 'sin descuento' },
                { icon: Boxes, label: 'Peso en riesgo', value: kg(productWeightKg(product)) },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-canvas p-3">
                  <s.icon className="h-4 w-4 text-brand-600" />
                  <p className="mt-2 text-[11.5px] text-ink-soft">{s.label}</p>
                  <p className="text-[14.5px] font-bold text-ink">{s.value}</p>
                  {s.hint && <p className="text-[11px] text-ink-faint">{s.hint}</p>}
                </div>
              ))}
            </div>
          </Card>

          <AiRecommendationPanel product={product} />
          <RiskExplainer product={product} />
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <SectionTitle title="Publicar en el marketplace" subtitle="Así verán los clientes este producto en Reverde." />
            <div className="mt-4 overflow-hidden rounded-2xl border border-black/5">
              <ProductThumb emoji={product.emoji} image={product.image} size="full" className="h-28 rounded-none text-5xl">
                <span className="absolute left-3 top-3">
                  <DiscountTag percent={product.discountPercent} />
                </span>
              </ProductThumb>
              <div className="p-3.5">
                <p className="text-[14px] font-bold text-ink">{product.name}</p>
                <p className="text-[12px] text-ink-soft">{est?.name} · {est?.distanceKm} km</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[18px] font-extrabold text-brand-700">{cop(finalPrice(product))}</span>
                  {product.discountPercent > 0 && (
                    <span className="pb-0.5 text-[12.5px] text-ink-faint line-through">{cop(product.originalPrice)}</span>
                  )}
                </div>
                <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1.5 text-[11.5px] text-brand-700">
                  Al comprarlo ayudas a evitar {kg(product.weightPerUnitKg)} de desperdicio.
                </p>
              </div>
            </div>

            <Button
              className="mt-4"
              block
              size="sm"
              variant={product.status === 'publicado' ? 'outline' : 'primary'}
              icon={<Upload className="h-4 w-4" />}
              onClick={() => {
                const next = product.status !== 'publicado';
                setPublished(product.id, next);
                toast({
                  title: next ? 'Publicado en el marketplace' : 'Retirado del marketplace',
                  description: product.name,
                  tone: next ? 'success' : 'info',
                });
              }}
            >
              {product.status === 'publicado' ? 'Retirar del marketplace' : 'Publicar ahora'}
            </Button>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionTitle title="Si no se vende" subtitle="Impacto estimado de no actuar" />
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-[#FDF1F0] p-3.5">
                <p className="text-[12px] text-[#B4453D]">Pérdida potencial</p>
                <p className="text-[22px] font-extrabold tracking-tight text-[#B4453D]">{cop(potentialLoss)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3.5">
                <p className="text-[12px] text-ink-soft">Desperdicio potencial</p>
                <p className="text-[22px] font-extrabold tracking-tight text-ink">{kg(productWeightKg(product))}</p>
              </div>
            </div>
          </Card>

          {learned && (
            <Card className="p-4 sm:p-5">
              <SectionTitle title="Histórico de la categoría" subtitle={product.category} />
              <dl className="mt-4 space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Mejor descuento</dt>
                  <dd className="font-bold text-ink">{learned.discount} %</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Inventario vendido</dt>
                  <dd className="font-bold text-ink">{learned.sellThrough} %</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Días hasta agotarse</dt>
                  <dd className="font-bold text-ink">{learned.days}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Promociones analizadas</dt>
                  <dd className="font-bold text-ink">{learned.samples}</dd>
                </div>
              </dl>
            </Card>
          )}

          <Link
            to="/app/inventario"
            className="block rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-center text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            Volver al inventario
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RecommendationDetail() {
  const { productId } = useParams();
  const { productById } = useApp();
  const navigate = useNavigate();
  const product = productById(productId);

  if (!product) {
    return (
      <EmptyState
        title="Producto no encontrado"
        description="Es posible que se haya eliminado del inventario."
        action={<Button size="sm" onClick={() => navigate('/app/inventario')}>Ir al inventario</Button>}
      />
    );
  }
  return <Detail product={product} />;
}
