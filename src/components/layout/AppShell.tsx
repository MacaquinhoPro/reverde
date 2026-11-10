import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LifeBuoy, LogOut, RotateCcw, Settings } from 'lucide-react';
import { Logo } from '../Logo';
import { Avatar } from '../ui/Primitives';
import { IconButton } from '../ui/Button';
import { Drawer } from '../ui/Modal';
import { Toggle } from '../ui/Field';
import { useApp } from '../../store/AppContext';
import { useReport } from '../../store/ReportContext';
import { byEstablishment } from '../../data/establishments';
import { cx } from '../../lib/format';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  mobile?: boolean;
}

export function AppShell({
  nav,
  children,
  title,
  alertsCount = 0,
}: {
  nav: NavItem[];
  children: ReactNode;
  title: string;
  alertsCount?: number;
}) {
  const { user, logout, resetDemo, toast } = useApp();
  const report = useReport();
  const [profileOpen, setProfileOpen] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [autoPublish, setAutoPublish] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const est = byEstablishment(user?.establishmentId);
  const mobileNav = nav.filter((n) => n.mobile !== false).slice(0, 5);

  const current = nav.find((n) => location.pathname.startsWith(n.to));
  const alertsRoute = nav.find((n) => n.label.includes('Alertas'))?.to;

  return (
    <div className="min-h-app bg-canvas">
      {/* ── Sidebar (escritorio) ─────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-black/5 bg-white lg:flex">
        <div className="px-6 pb-5 pt-6">
          <Logo size="sm" />
        </div>

        <div className="mx-4 mb-4 rounded-2xl bg-brand-50 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            {est ? (est.type === 'supermercado' ? 'Supermercado' : 'Restaurante') : 'Plataforma'}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-ink">{est?.name ?? 'Reverde global'}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">{est?.address ?? 'Todos los establecimientos'}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-brand-700 text-white shadow-glow'
                    : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700',
                )
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-risk-high px-1.5 text-[11px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-black/5 p-3">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-brand-50"
          >
            <Avatar name={user?.name ?? 'Reverde'} hue={user?.avatarHue} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">{user?.name}</span>
              <span className="block truncate text-[11.5px] text-ink-soft">{user?.email}</span>
            </span>
            <Settings className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
        </div>
      </aside>

      {/* ── Topbar ───────────────────────────────────────────────────── */}
      <header className="safe-top sticky top-0 z-30 border-b border-black/5 bg-canvas/85 backdrop-blur-xl lg:pl-[248px]">
        <div className="safe-x flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <h1 className="hidden text-[19px] font-bold tracking-tight text-ink lg:block">
            {current?.label ?? title}
          </h1>
          <div className="flex-1" />
          <IconButton label="Reportar un problema" onClick={report.open}>
            <LifeBuoy className="h-[18px] w-[18px]" />
          </IconButton>
          {alertsRoute && (
            <NavLink to={alertsRoute} className="relative">
              <IconButton label="Alertas">
                <Bell className="h-[18px] w-[18px]" />
                {alertsCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk-high px-1 text-[10px] font-bold text-white">
                    {alertsCount}
                  </span>
                )}
              </IconButton>
            </NavLink>
          )}
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Perfil y configuración"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl active:scale-95 lg:hidden"
          >
            <Avatar name={user?.name ?? 'R'} hue={user?.avatarHue} size="sm" />
          </button>
        </div>
      </header>

      {/* ── Contenido ────────────────────────────────────────────────── */}
      <main className="pb-nav-safe lg:pb-12 lg:pl-[248px]">
        <div className="safe-x mx-auto max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</div>
      </main>

      {/* ── Navegación inferior (móvil) ──────────────────────────────── */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 backdrop-blur-xl lg:hidden">
        <div className="safe-x mx-auto flex max-w-lg items-stretch">
          {mobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-nav-mobile flex-1 flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-semibold leading-tight transition-colors',
                  isActive ? 'text-brand-700' : 'text-ink-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('rounded-lg px-3 py-1 transition-colors', isActive && 'bg-brand-100')}>
                    {item.icon}
                  </span>
                  {item.label}
                  {!!item.badge && (
                    <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-risk-high" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Perfil y configuración ───────────────────────────────────── */}
      <Drawer open={profileOpen} onClose={() => setProfileOpen(false)} title="Perfil y configuración">
        <div className="flex items-center gap-3.5 rounded-2xl bg-brand-50 p-4">
          <Avatar name={user?.name ?? 'R'} hue={user?.avatarHue} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-ink">{user?.name}</p>
            <p className="truncate text-[12.5px] text-ink-soft">{user?.email}</p>
            <p className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-700">
              {user?.role}
            </p>
          </div>
        </div>

        {est && (
          <div className="mt-4 space-y-2 rounded-2xl border border-black/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Establecimiento</p>
            <p className="text-[14px] font-bold text-ink">{est.name}</p>
            <p className="text-[12.5px] text-ink-soft">{est.address}</p>
            <p className="text-[12.5px] text-ink-soft">{est.schedule}</p>
          </div>
        )}

        <div className="mt-4 space-y-4 rounded-2xl border border-black/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Preferencias</p>
          <Toggle checked={emailAlerts} onChange={setEmailAlerts} label="Recibir alertas por correo" />
          <Toggle checked={autoPublish} onChange={setAutoPublish} label="Publicar automáticamente alto riesgo" />
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={() => {
              setProfileOpen(false);
              report.open();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <LifeBuoy className="h-4 w-4" /> Reportar un problema
          </button>
          <button
            onClick={() => {
              resetDemo();
              setProfileOpen(false);
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <RotateCcw className="h-4 w-4" /> Reiniciar datos de la demo
          </button>
          <button
            onClick={() => {
              logout();
              toast({ title: 'Sesión cerrada', tone: 'info' });
              navigate('/login');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-[#B4453D] transition-colors hover:bg-[#FCEDEC]"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </Drawer>
    </div>
  );
}
