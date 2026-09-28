import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarCheck,
  Clock,
  Leaf,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { byEstablishment, ESTABLISHMENTS } from '../../data/establishments';
import { computeRisk, finalPrice } from '../../lib/ai';
import { useMarketplaceProducts } from '../../hooks/useMarketplace';
import { cop, expiryLabel, formatDate, kg } from '../../lib/format';
import { Card, EmptyState, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, DiscountTag } from '../../components/ui/Badge';
import { SimulatedMap } from '../../components/SimulatedMap';
import { ProductCard } from '../../components/ProductCard';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { productById, addToCart, toast, availableStock } = useApp();
  const [qty, setQty] = useState(1);
  const product = productById(id);
  const related = useMarketplaceProducts({ sort: 'relevancia' })
    .filter((p) => p.id !== id && p.category === product?.category)
    .slice(0, 4);

  if (!product) {
    return (
      <EmptyState
        title="Producto no disponible"
        description="Es posible que ya haya sido rescatado por otra persona."
        action={<Button size="sm" onClick={() => navigate('/tienda/explorar')}>Volver al marketplace</Button>}
      />
    );
  }

  const est = byEstablishment(product.establishmentId);
  const risk = computeRisk(product);
  const price = finalPrice(product);
  const savings = product.originalPrice - price;
  const stock = availableStock(product.id);
  const impact = product.weightPerUnitKg * qty;

  const add = (mode: 'carrito' | 'reserva' | 'compra') => {
    addToCart(product.id, qty);
    if (mode === 'carrito') {
      toast({ title: 'Agregado al carrito', description: `${qty} × ${product.name}` });
      return;
    }
    navigate(mode === 'reserva' ? '/tienda/checkout?modo=reserva' : '/tienda/checkout');
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
        Volver
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Galería */}
        <div className="space-y-3">
          <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="full" className="h-64 rounded-2xl text-8xl sm:h-80">
            <span className="absolute left-4 top-4 flex flex-col gap-2">
              <DiscountTag percent={product.discountPercent} />
              {product.isRescueBox && (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-brand-700 backdrop-blur">
                  <Leaf className="h-3 w-3" /> Caja de rescate
                </span>
              )}
            </span>
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
              <Clock className="h-3.5 w-3.5" /> {expiryLabel(product.expiryDate)}
            </span>
          </ProductThumb>

          {/* Tira de miniaturas: la foto real primero, luego los distintivos. */}
          <div className="grid grid-cols-4 gap-2">
            <ProductThumb
              emoji={product.emoji}
              image={product.image}
              photo={product.photo}
              alt={product.name}
              size="full"
              className="h-16 rounded-xl text-2xl ring-2 ring-brand-500"
            />
            {['📦', '🏷️', '🌿'].map((e) => (
              <div
                key={e}
                className={`flex h-16 items-center justify-center rounded-xl bg-gradient-to-br text-2xl opacity-70 ${product.image}`}
              >
                {e}
              </div>
            ))}
          </div>
        </div>

        {/* Información */}
        <div className="space-y-4">
          <div>
            <Link
              to={`/tienda/explorar?establecimiento=${est?.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink ring-1 ring-black/5 transition-colors hover:text-brand-700"
            >
              <Store className="h-3.5 w-3.5 text-brand-600" />
              {est?.name}
              <span className="flex items-center gap-0.5 text-ink-faint">
                <Star className="h-3 w-3 fill-brand-400 text-brand-400" /> {est?.rating}
              </span>
            </Link>
            <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink">{product.name}</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{product.description}</p>
          </div>

          <Card className="p-4 sm:p-5">
            <div className="flex items-end gap-3">
              <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">
                {cop(price)}
              </span>
              {product.discountPercent > 0 && (
                <span className="pb-1 text-[16px] font-medium text-ink-faint line-through">
                  {cop(product.originalPrice)}
                </span>
              )}
            </div>
            {savings > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#EAF6EF] px-2.5 py-1 text-[12.5px] font-bold text-risk-low">
                Ahorras {cop(savings)} por unidad
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 pt-4 text-[13px]">
              <div>
                <p className="text-ink-soft">Disponible</p>
                <p className="font-bold text-ink">{stock} {product.unit}{stock === 1 ? '' : 's'}</p>
              </div>
              <div>
                <p className="text-ink-soft">Consumir antes de</p>
                <p className="font-bold text-ink">{formatDate(product.expiryDate)}</p>
              </div>
              <div>
                <p className="text-ink-soft">Recogida</p>
                <p className="font-bold text-ink">{est?.schedule.split('·')[1]?.trim() ?? 'Todo el día'}</p>
              </div>
              <div>
                <p className="text-ink-soft">Distancia</p>
                <p className="font-bold text-ink">{est?.distanceKm} km</p>
              </div>
            </div>

            {/* Cantidad */}
            <div className="mt-4 flex items-center gap-3 border-t border-black/5 pt-4">
              <span className="text-[13px] font-semibold text-ink">Cantidad</span>
              <div className="ml-auto flex items-center gap-1 rounded-xl bg-black/[0.035] p-1">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink shadow-soft transition-transform active:scale-95"
                  aria-label="Reducir cantidad"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-9 text-center text-[15px] font-bold text-ink">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(stock, q + 1))}
                  disabled={qty >= stock}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-ink shadow-soft transition-transform active:scale-95 disabled:opacity-40"
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button block size="lg" disabled={stock === 0} icon={<ShoppingBag className="h-4 w-4" />} onClick={() => add('compra')}>
                Comprar ahora
              </Button>
              <Button block size="lg" variant="secondary" disabled={stock === 0} icon={<CalendarCheck className="h-4 w-4" />} onClick={() => add('reserva')}>
                Reservar
              </Button>
            </div>
            <Button block variant="outline" size="sm" className="mt-2" disabled={stock === 0} onClick={() => add('carrito')}>
              Agregar al carrito
            </Button>
          </Card>

          {/* Impacto */}
          <Card className="bg-brand-700 p-4 text-white sm:p-5">
            <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-200">
              <Leaf className="h-3.5 w-3.5" /> Tu impacto
            </p>
            <p className="mt-2 text-[15px] font-bold leading-snug">
              Al rescatar este producto estás ayudando a reducir el desperdicio de alimentos.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-[19px] font-extrabold">{impact >= 1 ? kg(impact) : `${Math.round(impact * 1000)} g`}</p>
                <p className="text-[11.5px] text-brand-100">de comida rescatada</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-[19px] font-extrabold">{cop(savings * qty)}</p>
                <p className="text-[11.5px] text-brand-100">de ahorro para ti</p>
              </div>
            </div>
          </Card>

          <Card className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Producto en buen estado, próximo a su fecha de vencimiento ({expiryLabel(product.expiryDate)}).
              Reverde estima un riesgo de desperdicio de <strong className="text-ink">{risk.wasteProbability} %</strong> si
              nadie lo rescata hoy.
            </p>
          </Card>

          {/* Ubicación */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-start gap-3 p-4">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-ink">{est?.name}</p>
                <p className="text-[12.5px] text-ink-soft">{est?.address}, {est?.city}</p>
                <p className="text-[12.5px] text-ink-faint">{est?.schedule}</p>
              </div>
              <Badge tone="brand">{est?.distanceKm} km</Badge>
            </div>
            <SimulatedMap
              establishments={ESTABLISHMENTS.filter((e) => e.id === est?.id)}
              highlightId={est?.id}
              compact
              className="h-40 rounded-none border-0 border-t border-black/5"
            />
          </Card>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <SectionTitle title="También te puede interesar" subtitle={`Más productos de ${product.category.toLowerCase()}`} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
