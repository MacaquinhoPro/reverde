import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Leaf, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { byEstablishment } from '../../data/establishments';
import { finalPrice } from '../../lib/ai';
import { cop, kg } from '../../lib/format';
import { Card, EmptyState, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export default function Cart() {
  const { cart, products, setCartQty, removeFromCart, clearCart, toast } = useApp();
  const navigate = useNavigate();

  const lines = cart
    .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
    .filter((x): x is { line: typeof cart[number]; product: NonNullable<typeof x.product> } => Boolean(x.product));

  const subtotal = lines.reduce((s, { line, product }) => s + finalPrice(product) * line.qty, 0);
  const original = lines.reduce((s, { line, product }) => s + product.originalPrice * line.qty, 0);
  const savings = original - subtotal;
  const impactKg = lines.reduce((s, { line, product }) => s + product.weightPerUnitKg * line.qty, 0);
  const items = lines.reduce((s, { line }) => s + line.qty, 0);

  if (lines.length === 0) {
    return (
      <div className="space-y-5">
        <SectionTitle title="Tu carrito" />
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Tu carrito está vacío"
          description="Explora el marketplace y rescata productos frescos a mejor precio antes de que se pierdan."
          action={<Button size="sm" to="/tienda/explorar">Explorar marketplace</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Tu carrito"
        subtitle={`${items} producto${items === 1 ? '' : 's'} listos para rescatar`}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => { clearCart(); toast({ title: 'Carrito vacío', tone: 'info' }); }}
          >
            Vaciar
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Líneas */}
        <div className="space-y-2.5">
          {lines.map(({ line, product }) => {
            const est = byEstablishment(product.establishmentId);
            const price = finalPrice(product);
            return (
              <Card key={product.id} className="p-3.5">
                <div className="flex gap-3.5">
                  <Link to={`/tienda/producto/${product.id}`}>
                    <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/tienda/producto/${product.id}`} className="truncate text-[14.5px] font-bold text-ink hover:text-brand-700">
                        {product.name}
                      </Link>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="-m-1 shrink-0 p-1 text-ink-faint transition-colors hover:text-[#B4453D]"
                        aria-label="Quitar del carrito"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-ink-soft">{est?.name} · {est?.distanceKm} km</p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 rounded-xl bg-black/[0.035] p-1">
                        <button
                          onClick={() => setCartQty(product.id, line.qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-soft transition-transform active:scale-95"
                          aria-label="Reducir"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-[13.5px] font-bold">{line.qty}</span>
                        <button
                          onClick={() => setCartQty(product.id, line.qty + 1)}
                          disabled={line.qty >= product.quantity}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-soft transition-transform active:scale-95 disabled:opacity-40"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-[15px] font-extrabold text-brand-700">{cop(price * line.qty)}</p>
                        {product.discountPercent > 0 && (
                          <p className="text-[12px] text-ink-faint line-through">{cop(product.originalPrice * line.qty)}</p>
                        )}
                      </div>
                    </div>
                    {line.qty >= product.quantity && (
                      <p className="mt-1.5 text-[11.5px] font-medium text-[#A9761A]">
                        Es todo el stock disponible de este producto.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-4 sm:p-5">
            <h3 className="text-[15px] font-bold text-ink">Resumen</h3>
            <dl className="mt-4 space-y-2.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Precio original</dt>
                <dd className="text-ink-faint line-through">{cop(original)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="font-bold text-ink">{cop(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Ahorraste</dt>
                <dd className="font-bold text-risk-low">{cop(savings)}</dd>
              </div>
              <div className="flex justify-between border-t border-black/5 pt-2.5">
                <dt className="text-ink-soft">Alimentos rescatados</dt>
                <dd className="font-bold text-ink">{kg(impactKg)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-brand-50 p-4">
              <span className="text-[13px] font-semibold text-ink">Total a pagar</span>
              <span className="text-[24px] font-extrabold tracking-tight text-brand-700">{cop(subtotal)}</span>
            </div>

            <div className="mt-4 space-y-2">
              <Button block size="lg" icon={<ShoppingBag className="h-4 w-4" />} onClick={() => navigate('/tienda/checkout')}>
                Continuar a la compra
              </Button>
              <Button block variant="outline" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => navigate('/tienda/checkout?modo=reserva')}>
                Reservar y pagar en el local
              </Button>
            </div>
          </Card>

          <Card className="bg-brand-700 p-4 text-white">
            <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-200">
              <Leaf className="h-3.5 w-3.5" /> Impacto de esta compra
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-brand-100">
              Estás rescatando <strong className="text-white">{kg(impactKg)}</strong> de alimentos que iban camino a
              convertirse en desperdicio, y ahorrando <strong className="text-white">{cop(savings)}</strong>.
            </p>
          </Card>

          <Link to="/tienda/explorar" className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
            Seguir explorando <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <div className="flex flex-wrap gap-1.5">
            {[...new Set(lines.map(({ product }) => product.establishmentId))].map((id) => (
              <Badge key={id} tone="neutral">{byEstablishment(id)?.name}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
