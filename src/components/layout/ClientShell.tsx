import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, Home, MapPin, ShoppingBag, User } from 'lucide-react';
import { Logo } from '../Logo';
import { Avatar } from '../ui/Primitives';
import { useApp } from '../../store/AppContext';
import { cx } from '../../lib/format';

const ITEMS = [
  { to: '/tienda', label: 'Inicio', icon: Home, end: true },
  { to: '/tienda/explorar', label: 'Explorar', icon: Compass, end: false },
  { to: '/tienda/mapa', label: 'Mapa', icon: MapPin, end: false },
  { to: '/tienda/carrito', label: 'Carrito', icon: ShoppingBag, end: false },
  { to: '/tienda/perfil', label: 'Perfil', icon: User, end: false },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const { user, cartCount } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Topbar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-4 sm:px-6">
          <button onClick={() => navigate('/tienda')}>
            <Logo size="sm" />
          </button>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {ITEMS.slice(0, 3).map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-xl px-3.5 py-2 text-[14px] font-medium transition-colors',
                    isActive ? 'bg-brand-100 text-brand-700' : 'text-ink-soft hover:text-ink',
                  )
                }
              >
                {i.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            <NavLink
              to="/tienda/carrito"
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700 md:inline-flex"
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/tienda/perfil">
              <Avatar name={user?.name ?? 'Invitado'} hue={user?.avatarHue ?? 200} size="sm" />
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:pb-14">{children}</main>

      {/* ── Navegación inferior (móvil) ──────────────────────────────── */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch">
          {ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors',
                  isActive ? 'text-brand-700' : 'text-ink-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('relative rounded-lg px-3.5 py-1 transition-colors', isActive && 'bg-brand-100')}>
                    <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.4 : 2} />
                    {label === 'Carrito' && cartCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[9.5px] font-bold text-white">
                        {cartCount}
                      </span>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
