import { MapPin, Navigation, Store, Utensils } from 'lucide-react';
import type { Establishment } from '../types';
import { cx } from '../lib/format';

/**
 * Mapa simulado: no usa servicios externos. Dibuja una retícula urbana y
 * posiciona los establecimientos con coordenadas porcentuales.
 */
export function SimulatedMap({
  establishments,
  selectedId,
  onSelect,
  className,
  compact,
  highlightId,
}: {
  establishments: Establishment[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  compact?: boolean;
  highlightId?: string;
}) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl border border-black/5 bg-[#EEF5EF]',
        className,
      )}
    >
      {/* Retícula de calles */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="rvGrid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="rgba(31,93,66,0.07)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rvGrid)" />
        {/* Avenidas y parque */}
        <rect x="0" y="43%" width="100%" height="16" fill="rgba(255,255,255,.75)" />
        <rect x="38%" y="0" width="14" height="100%" fill="rgba(255,255,255,.75)" />
        <circle cx="76%" cy="20%" r="52" fill="rgba(114,181,139,.22)" />
        <circle cx="14%" cy="82%" r="40" fill="rgba(114,181,139,.18)" />
      </svg>

      {/* Tu ubicación */}
      <div className="absolute" style={{ left: '44%', top: '50%', transform: 'translate(-50%,-50%)' }}>
        <span className="absolute inset-0 -m-3 animate-pulse-ring rounded-full bg-brand-400/40" />
        <span className="relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-brand-700 shadow-lift" />
        {!compact && (
          <span className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-ink shadow-soft backdrop-blur">
            Tú
          </span>
        )}
      </div>

      {/* Pines */}
      {establishments.map((e) => {
        const active = selectedId === e.id || highlightId === e.id;
        const Icon = e.type === 'supermercado' ? Store : Utensils;
        return (
          <button
            key={e.id}
            onClick={() => onSelect?.(e.id)}
            className="group absolute -translate-x-1/2 -translate-y-full transition-transform duration-200 hover:z-20 hover:scale-110"
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
            aria-label={e.name}
          >
            <span
              className={cx(
                'flex items-center gap-1.5 rounded-full border-2 border-white px-2.5 py-1.5 shadow-lift transition-colors',
                active ? 'bg-brand-700 text-white' : 'bg-white text-brand-700',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {!compact && <span className="max-w-[110px] truncate text-[11px] font-bold">{e.name}</span>}
            </span>
            <span
              className={cx(
                'mx-auto block h-2 w-2 rotate-45 border-b-2 border-r-2 border-white',
                active ? 'bg-brand-700' : 'bg-white',
              )}
              style={{ marginTop: -4 }}
            />
          </button>
        );
      })}

      {/* Leyenda */}
      {!compact && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-xl bg-white/90 p-2.5 text-[11px] shadow-soft backdrop-blur">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <Store className="h-3 w-3 text-brand-700" /> Supermercado
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <Utensils className="h-3 w-3 text-brand-700" /> Restaurante
          </span>
          <span className="flex items-center gap-1.5 text-ink-soft">
            <MapPin className="h-3 w-3" /> Mapa simulado
          </span>
        </div>
      )}
      {compact && (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-semibold text-ink-soft backdrop-blur">
          <Navigation className="h-3 w-3" /> Mapa simulado
        </span>
      )}
    </div>
  );
}
