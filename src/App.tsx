import { useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  Building2,
  Home,
  Leaf,
  LayoutDashboard,
  ShoppingBag,
  Sparkles,
  Receipt,
} from 'lucide-react';
import type { Role } from './types';
import { AppProvider, useApp } from './store/AppContext';
import { AppShell, type NavItem } from './components/layout/AppShell';
import { ClientShell } from './components/layout/ClientShell';
import { Toaster } from './components/ui/Toaster';
import { useEstablishmentData } from './hooks/useEstablishmentData';
import { homeForRole } from './lib/routes';

import Landing from './pages/Landing';
import Login from './pages/Login';

import AdminDashboard from './pages/admin/Dashboard';
import Inventory from './pages/admin/Inventory';
import Alerts from './pages/admin/Alerts';
import RecommendationDetail from './pages/admin/RecommendationDetail';
import MarketplaceAdmin from './pages/admin/MarketplaceAdmin';
import Sales from './pages/admin/Sales';
import Impact from './pages/admin/Impact';

import ClientHome from './pages/client/Home';
import Marketplace from './pages/client/Marketplace';
import ProductDetail from './pages/client/ProductDetail';
import Cart from './pages/client/Cart';
import Checkout from './pages/client/Checkout';
import Confirmation from './pages/client/Confirmation';
import MapView from './pages/client/MapView';
import Profile from './pages/client/Profile';

import SuperDashboard from './pages/super/SuperDashboard';
import Establishments from './pages/super/Establishments';
import EstablishmentDetail from './pages/super/EstablishmentDetail';
import Publications from './pages/super/Publications';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }), [pathname]);
  return null;
}

/** Protege rutas según el rol de la sesión simulada. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

const ICON = 'h-[18px] w-[18px]';

function AdminLayout({ children }: { children: ReactNode }) {
  const { alerts } = useEstablishmentData();
  const highAlerts = alerts.filter((a) => a.level === 'alto').length;

  const nav: NavItem[] = [
    { to: '/app/inicio', label: 'Inicio', icon: <Home className={ICON} /> },
    { to: '/app/inventario', label: 'Inventario', icon: <Boxes className={ICON} /> },
    { to: '/app/alertas', label: 'Alertas IA', icon: <Sparkles className={ICON} />, badge: alerts.length || undefined },
    { to: '/app/marketplace', label: 'Marketplace', icon: <ShoppingBag className={ICON} /> },
    { to: '/app/ventas', label: 'Ventas', icon: <Receipt className={ICON} />, mobile: false },
    { to: '/app/impacto', label: 'Impacto', icon: <Leaf className={ICON} /> },
  ];

  return (
    <AppShell nav={nav} title="Reverde" alertsCount={highAlerts}>
      {children}
    </AppShell>
  );
}

function SuperLayout({ children }: { children: ReactNode }) {
  const nav: NavItem[] = [
    { to: '/admin/inicio', label: 'Resumen global', icon: <LayoutDashboard className={ICON} /> },
    { to: '/admin/establecimientos', label: 'Establecimientos', icon: <Building2 className={ICON} /> },
    { to: '/admin/publicaciones', label: 'Publicaciones', icon: <ShoppingBag className={ICON} /> },
    { to: '/admin/actividad', label: 'Actividad', icon: <BarChart3 className={ICON} /> },
  ];
  return (
    <AppShell nav={nav} title="Reverde · Superadmin">
      {children}
    </AppShell>
  );
}

function Shell() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* ── Establecimientos ─────────────────────────────────────── */}
        <Route
          path="/app/*"
          element={
            <RequireRole roles={['supermercado', 'restaurante']}>
              <AdminLayout>
                <Routes>
                  <Route index element={<Navigate to="inicio" replace />} />
                  <Route path="inicio" element={<AdminDashboard />} />
                  <Route path="inventario" element={<Inventory />} />
                  <Route path="alertas" element={<Alerts />} />
                  <Route path="alertas/:productId" element={<RecommendationDetail />} />
                  <Route path="marketplace" element={<MarketplaceAdmin />} />
                  <Route path="ventas" element={<Sales />} />
                  <Route path="impacto" element={<Impact />} />
                  <Route path="*" element={<Navigate to="/app/inicio" replace />} />
                </Routes>
              </AdminLayout>
            </RequireRole>
          }
        />

        {/* ── Superadmin ───────────────────────────────────────────── */}
        <Route
          path="/admin/*"
          element={
            <RequireRole roles={['superadmin']}>
              <SuperLayout>
                <Routes>
                  <Route index element={<Navigate to="inicio" replace />} />
                  <Route path="inicio" element={<SuperDashboard />} />
                  <Route path="establecimientos" element={<Establishments />} />
                  <Route path="establecimientos/:id" element={<EstablishmentDetail />} />
                  <Route path="publicaciones" element={<Publications />} />
                  <Route path="actividad" element={<Publications />} />
                  <Route path="*" element={<Navigate to="/admin/inicio" replace />} />
                </Routes>
              </SuperLayout>
            </RequireRole>
          }
        />

        {/* ── Clientes (navegación abierta para la demo) ───────────── */}
        <Route
          path="/tienda/*"
          element={
            <ClientShell>
              <Routes>
                <Route index element={<ClientHome />} />
                <Route path="explorar" element={<Marketplace />} />
                <Route path="producto/:id" element={<ProductDetail />} />
                <Route path="mapa" element={<MapView />} />
                <Route path="carrito" element={<Cart />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="confirmacion/:orderId" element={<Confirmation />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="*" element={<Navigate to="/tienda" replace />} />
              </Routes>
            </ClientShell>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  );
}
