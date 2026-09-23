import { Link } from 'react-router-dom';
import { Clock, Leaf, MapPin, Plus, Star } from 'lucide-react';
import type { Product } from '../types';
import { finalPrice } from '../lib/ai';
import { byEstablishment } from '../data/establishments';
import { cop, cx, expiryLabel } from '../lib/format';
import { DiscountTag } from './ui/Badge';
import { ProductThumb } from './ui/Primitives';
import { useApp } from '../store/AppContext';

export function ProductCard({ product, compact }: { product: Product; compact?: boolean }) {
  const { addToCart, toast, availableStock } = useApp();
  const est = byEstablishment(product.establishmentId);
  const price = finalPrice(product);
  const stock = availableStock(product.id);
  const impactKg = product.weightPerUnitKg;

  return (
    <article className="group card card-hover relative flex flex-col overflow-hidden">
      <Link to={`/tienda/producto/${product.id}`} className="block">
        <div className="relative">
          <ProductThumb
            emoji={product.emoji}
            image={product.image}
            size="full"
            className={cx('rounded-none', compact ? 'h-28 text-5xl' : 'h-36 text-6xl sm:h-40')}
          />
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            <DiscountTag percent={product.discountPercent} />
            {product.isRescueBox && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-bold text-brand-700 backdrop-blur">
                <Leaf className="h-3 w-3" /> Caja de rescate
              </span>
            )}
          </div>
          {product.featured && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-bold text-brand-700 backdrop-blur">
              <Star className="h-3 w-3 fill-brand-400 text-brand-400" /> Destacado
            </span>
          )}
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur">
            <Clock className="h-3 w-3" /> {expiryLabel(product.expiryDate)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <Link to={`/tienda/producto/${product.id}`}>
          <h3 className="line-clamp-2 text-[14.5px] font-bold leading-snug text-ink transition-colors group-hover:text-brand-700">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-soft">
          <span className="truncate">{est?.name}</span>
          <span className="text-ink-faint">·</span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-ink-faint">
            <MapPin className="h-3 w-3" />
            {est?.distanceKm} km
          </span>
        </p>

        <div className="mt-2.5 flex items-end gap-2">
          <span className="text-[19px] font-extrabold tracking-tight text-brand-700">{cop(price)}</span>
          {product.discountPercent > 0 && (
            <span className="pb-0.5 text-[13px] font-medium text-ink-faint line-through">
              {cop(product.originalPrice)}
            </span>
          )}
        </div>

        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-brand-50 px-2 py-1.5 text-[11.5px] leading-tight text-brand-700">
          <Leaf className="mt-px h-3 w-3 shrink-0" />
          Evitas {impactKg >= 1 ? `${impactKg.toFixed(1)} kg` : `${Math.round(impactKg * 1000)} g`} de desperdicio
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 text-[11.5px] font-medium text-ink-faint">
            {stock > 0 ? `${stock} disponible${stock === 1 ? '' : 's'}` : 'Agotado'}
          </span>
          <button
            disabled={stock === 0}
            onClick={() => {
              addToCart(product.id);
              toast({ title: 'Agregado al carrito', description: product.name });
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-glow transition-all duration-200 hover:bg-brand-800 active:scale-95 disabled:bg-black/10 disabled:text-ink-faint disabled:shadow-none"
            aria-label={`Agregar ${product.name} al carrito`}
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </article>
  );
}
