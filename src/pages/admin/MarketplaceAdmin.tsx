import { ExternalLink, Eye, Plus, ShoppingBag, Star, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEstablishmentData } from '../../hooks/useEstablishmentData';
import { useApp } from '../../store/AppContext';
import { finalPrice } from '../../lib/ai';
import { cop, expiryLabel, kg, qtyLabel } from '../../lib/format';
import { Card, EmptyState, KpiCard, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { DiscountTag, RiskBadge } from '../../components/ui/Badge';

export default function MarketplaceAdmin() {
  const { scored } = useEstablishmentData();
  const { setPublished, updateProduct, toast } = useApp();

  const published = scored.filter((s) => s.product.status === 'publicado');
  const candidates = scored.filter((s) => s.product.status === 'en_inventario' && s.risk.level !== 'bajo').slice(0, 6);
  const publishedValue = published.reduce((sum, s) => sum + finalPrice(s.product) * s.product.quantity, 0);
  const publishedKg = published.reduce((sum, s) => sum + s.product.weightPerUnitKg * s.product.quantity, 0);
  const avgDiscount = published.length
    ? published.reduce((s, p) => s + p.product.discountPercent, 0) / published.length
    : 0;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Mis publicaciones"
        subtitle="Productos visibles ahora mismo para los clientes en el marketplace de Reverde."
        action={
          <Button to="/tienda" variant="outline" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
            Ver como cliente
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Productos publicados" value={String(published.length)} icon={<ShoppingBag className="h-4 w-4" />} tone="brand" />
        <KpiCard label="Valor publicado" value={cop(publishedValue)} icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard label="Descuento promedio" value={`${Math.round(avgDiscount)} %`} icon={<Star className="h-4 w-4" />} />
        <KpiCard label="Alimento en oferta" value={publishedKg.toFixed(1).replace('.', ',')} unit="kg" icon={<Upload className="h-4 w-4" />} />
      </div>

      {published.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Aún no tienes publicaciones"
          description="Publica desde el inventario o desde una alerta de IA para que los clientes puedan rescatar tus productos."
          action={<Button size="sm" to="/app/inventario">Ir al inventario</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {published.map(({ product, risk }) => (
            <Card key={product.id} className="overflow-hidden p-0">
              <div className="relative">
                <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="full" className="h-28 rounded-none text-5xl" />
                <span className="absolute left-3 top-3">
                  <DiscountTag percent={product.discountPercent} />
                </span>
                {product.featured && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-bold text-brand-700">
                    <Star className="h-3 w-3 fill-brand-400 text-brand-400" /> Destacado
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[14px] font-bold text-ink">{product.name}</p>
                  <RiskBadge level={risk.level} score={risk.score} size="sm" showScore={false} />
                </div>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  {qtyLabel(product.quantity, product.unit)} · {expiryLabel(product.expiryDate)} · {kg(product.weightPerUnitKg * product.quantity)}
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[17px] font-extrabold text-brand-700">{cop(finalPrice(product))}</span>
                  {product.discountPercent > 0 && (
                    <span className="pb-0.5 text-[12.5px] text-ink-faint line-through">{cop(product.originalPrice)}</span>
                  )}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Button to={`/tienda/producto/${product.id}`} variant="outline" size="sm" className="flex-1" icon={<Eye className="h-3.5 w-3.5" />}>
                    Ver ficha
                  </Button>
                  <Button
                    variant={product.featured ? 'secondary' : 'ghost'}
                    size="sm"
                    className="px-3"
                    onClick={() => {
                      updateProduct(product.id, { featured: !product.featured });
                      toast({ title: product.featured ? 'Ya no está destacado' : 'Producto destacado', description: product.name, tone: 'info' });
                    }}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-3"
                    onClick={() => {
                      setPublished(product.id, false);
                      toast({ title: 'Retirado del marketplace', description: product.name, tone: 'info' });
                    }}
                  >
                    Retirar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {candidates.length > 0 && (
        <Card className="p-4 sm:p-5">
          <SectionTitle
            title="Listos para publicar"
            subtitle="Productos en riesgo que aún no están en el marketplace."
          />
          <ul className="mt-4 space-y-2">
            {candidates.map(({ product, risk, recommendation }) => (
              <li key={product.id} className="flex items-center gap-3 rounded-xl border border-black/5 p-3">
                <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link to={`/app/alertas/${product.id}`} className="truncate text-[13.5px] font-bold text-ink hover:text-brand-700">
                    {product.name}
                  </Link>
                  <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                    {expiryLabel(product.expiryDate)} · IA sugiere {recommendation.suggestedDiscount} % de descuento
                  </p>
                </div>
                <RiskBadge level={risk.level} score={risk.score} size="sm" showScore={false} />
                <Button
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setPublished(product.id, true);
                    toast({ title: 'Publicado en el marketplace', description: product.name });
                  }}
                >
                  Publicar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
