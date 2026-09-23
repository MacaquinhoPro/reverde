import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, Droplets, Leaf, LogOut, PackageCheck, Receipt, RotateCcw, Settings, Wallet } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { clientMetrics, co2FromKg, waterFromKg } from '../../lib/metrics';
import { byEstablishment } from '../../data/establishments';
import { cop, formatDateTime, kg } from '../../lib/format';
import { Avatar, Card, EmptyState, KpiCard, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Field';

export default function Profile() {
  const { user, orders, logout, resetDemo, toast } = useApp();
  const navigate = useNavigate();
  const [notify, setNotify] = useState(true);
  const [nearbyOnly, setNearbyOnly] = useState(false);

  if (!user) {
    return (
      <EmptyState
        icon={<Leaf className="h-5 w-5" />}
        title="Inicia sesión para ver tu perfil"
        description="Con tu cuenta puedes seguir tus pedidos, reservas y el impacto que has generado."
        action={<Button size="sm" to="/login?rol=cliente">Entrar como cliente</Button>}
      />
    );
  }

  const m = clientMetrics(orders, user.id);
  const mine = orders.filter((o) => o.userId === user.id);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar name={user.name} hue={user.avatarHue} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-extrabold tracking-[-0.025em] text-ink">{user.name}</h1>
          <p className="text-[13px] text-ink-soft">{user.email}</p>
          <Badge tone="brand" className="mt-1.5">Cliente Reverde</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<LogOut className="h-4 w-4" />}
          onClick={() => { logout(); toast({ title: 'Sesión cerrada', tone: 'info' }); navigate('/login?rol=cliente'); }}
        >
          Cerrar sesión
        </Button>
      </Card>

      {/* Impacto acumulado */}
      <Card className="bg-brand-700 p-5 text-white">
        <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-200">
          <Leaf className="h-3.5 w-3.5" /> Tu impacto acumulado
        </p>
        <p className="mt-2.5 text-[17px] font-bold leading-snug sm:text-[19px]">
          Gracias a tus compras en Reverde has rescatado {m.rescued} producto{m.rescued === 1 ? '' : 's'} y ayudado a
          evitar {kg(m.wasteAvoidedKg)} de desperdicio.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-3.5">
            <Wallet className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[20px] font-extrabold">{cop(m.saved)}</p>
            <p className="text-[11px] text-brand-100">ahorrados</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3.5">
            <PackageCheck className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[20px] font-extrabold">{m.rescued}</p>
            <p className="text-[11px] text-brand-100">productos rescatados</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3.5">
            <Leaf className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[20px] font-extrabold">{co2FromKg(m.wasteAvoidedKg)} kg</p>
            <p className="text-[11px] text-brand-100">CO₂e evitado</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3.5">
            <Droplets className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[20px] font-extrabold">{waterFromKg(m.wasteAvoidedKg).toLocaleString('es-CO')} L</p>
            <p className="text-[11px] text-brand-100">agua ahorrada</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Pedidos" value={String(m.orders)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Reservas" value={String(m.reservations)} icon={<CalendarCheck className="h-4 w-4" />} />
        <KpiCard label="Total gastado" value={cop(m.spent)} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Dinero ahorrado" value={cop(m.saved)} icon={<Wallet className="h-4 w-4" />} tone="brand" />
      </div>

      {/* Pedidos */}
      <div>
        <SectionTitle title="Mis pedidos y reservas" subtitle={`${mine.length} en total`} />
        <div className="mt-4 space-y-2.5">
          {mine.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="Todavía no tienes pedidos"
              description="Cuando rescates tu primer producto aparecerá aquí con su impacto."
              action={<Button size="sm" to="/tienda/explorar">Explorar marketplace</Button>}
            />
          ) : (
            mine.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone={o.mode === 'reserva' ? 'amber' : 'green'}>
                    {o.mode === 'reserva' ? 'Reserva' : 'Compra'}
                  </Badge>
                  <span className="text-[13.5px] font-bold text-ink">{o.code}</span>
                  <span className="text-[12.5px] text-ink-soft">{formatDateTime(o.createdAt)}</span>
                  <span className="ml-auto text-[16px] font-extrabold text-brand-700">{cop(o.total)}</span>
                </div>

                <ul className="mt-3 flex flex-wrap gap-2">
                  {o.items.map((i) => (
                    <li key={i.productId} className="flex items-center gap-2 rounded-xl bg-canvas px-2.5 py-1.5">
                      <ProductThumb emoji={i.emoji} image={i.image} size="xs" />
                      <span className="text-[12.5px] font-medium text-ink">{i.name}</span>
                      <span className="text-[11.5px] text-ink-faint">×{i.qty}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/5 pt-3 text-[12.5px] text-ink-soft">
                  <span>{o.establishmentIds.map((id) => byEstablishment(id)?.name).join(', ')}</span>
                  <span className="font-semibold text-risk-low">Ahorraste {cop(o.savings)}</span>
                  <span className="font-semibold text-brand-700">{kg(o.wasteAvoidedKg)} rescatados</span>
                  <Link to={`/tienda/confirmacion/${o.id}`} className="ml-auto font-semibold text-brand-700 hover:underline">
                    Ver detalle
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Configuración */}
      <Card className="p-4 sm:p-5">
        <SectionTitle title="Preferencias" subtitle="Configuración de la cuenta" />
        <div className="mt-4 space-y-4">
          <Toggle checked={notify} onChange={setNotify} label="Avisarme cuando haya productos cerca" />
          <Toggle checked={nearbyOnly} onChange={setNearbyOnly} label="Mostrar solo establecimientos a menos de 2 km" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-black/5 pt-4">
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={() => { resetDemo(); navigate('/'); }}
          >
            Reiniciar datos de la demo
          </Button>
          <Button variant="ghost" size="sm" to="/login" icon={<Settings className="h-4 w-4" />}>
            Cambiar de rol
          </Button>
        </div>
      </Card>
    </div>
  );
}
