import { useParams } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Clock, Copy, Droplets, Leaf, MapPin, Receipt, ShoppingBag } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { byEstablishment } from '../../data/establishments';
import { co2FromKg, waterFromKg } from '../../lib/metrics';
import { cop, formatDateTime, kg } from '../../lib/format';
import { Card, EmptyState, ProductThumb } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const PAYMENT_LABEL = {
  tarjeta: 'Tarjeta de crédito/débito',
  pse: 'PSE',
  establecimiento: 'Pago en el establecimiento',
} as const;

export default function Confirmation() {
  const { orderId } = useParams();
  const { orders, toast } = useApp();
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <EmptyState
        title="No encontramos este pedido"
        description="Puede que la demo se haya reiniciado."
        action={<Button size="sm" to="/tienda/explorar">Ir al marketplace</Button>}
      />
    );
  }

  const reserved = order.mode === 'reserva';
  const units = order.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* Cabecera */}
      <Card className="overflow-hidden p-0 text-center">
        <div className="bg-brand-700 px-6 py-8 text-white">
          <span className="mx-auto flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-white/15">
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
          </span>
          <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.03em]">
            {reserved ? 'Reserva confirmada' : 'Compra confirmada'}
          </h1>
          <p className="mt-1.5 text-[14px] text-brand-100">
            {reserved
              ? 'Tu pedido quedó apartado. Paga al recogerlo.'
              : 'Ya puedes pasar a recoger tu pedido.'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-canvas px-5 py-4">
          <div className="text-left">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">Código de {reserved ? 'reserva' : 'compra'}</p>
            <p className="text-[22px] font-extrabold tracking-tight text-ink">{order.code}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => {
              navigator.clipboard?.writeText(order.code);
              toast({ title: 'Código copiado', description: order.code, tone: 'info' });
            }}
          >
            Copiar
          </Button>
        </div>

        <div className="space-y-4 p-5 text-left">
          {/* Establecimientos */}
          {order.establishmentIds.map((id) => {
            const est = byEstablishment(id);
            return (
              <div key={id} className="flex items-start gap-3 rounded-2xl bg-canvas p-4">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">{est?.name}</p>
                  <p className="text-[12.5px] text-ink-soft">{est?.address}, {est?.city}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
                    <Clock className="h-3.5 w-3.5" /> Recoger: {order.pickupWindow}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Productos */}
          <div>
            <p className="mb-2.5 inline-flex items-center gap-2 text-[13px] font-bold text-ink">
              <ShoppingBag className="h-4 w-4 text-brand-600" /> {units} producto{units === 1 ? '' : 's'}
            </p>
            <ul className="space-y-2.5">
              {order.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-3">
                  <ProductThumb emoji={i.emoji} image={i.image} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{i.name}</p>
                    <p className="text-[11.5px] text-ink-soft">{i.qty} × {cop(i.unitPrice)}</p>
                  </div>
                  <span className="text-[13.5px] font-bold text-ink">{cop(i.unitPrice * i.qty)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Totales */}
          <dl className="space-y-2 border-t border-black/5 pt-4 text-[13.5px]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Método de pago</dt>
              <dd className="font-semibold text-ink">{PAYMENT_LABEL[order.payment]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Fecha</dt>
              <dd className="font-semibold text-ink">{formatDateTime(order.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Ahorro Reverde</dt>
              <dd className="font-bold text-risk-low">{cop(order.savings)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-black/5 pt-3">
              <dt className="text-[14px] font-bold text-ink">Total</dt>
              <dd className="text-[22px] font-extrabold tracking-tight text-brand-700">{cop(order.total)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Impacto */}
      <Card className="bg-brand-700 p-5 text-white">
        <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-200">
          <Leaf className="h-3.5 w-3.5" /> Impacto ambiental de tu pedido
        </p>
        <p className="mt-2 text-[15px] font-bold leading-snug">
          Rescataste {kg(order.wasteAvoidedKg)} de alimentos en perfecto estado.
        </p>
        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-white/10 p-3">
            <Leaf className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[17px] font-extrabold">{co2FromKg(order.wasteAvoidedKg)} kg</p>
            <p className="text-[11px] leading-tight text-brand-100">CO₂e evitado</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <Droplets className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[17px] font-extrabold">{waterFromKg(order.wasteAvoidedKg).toLocaleString('es-CO')} L</p>
            <p className="text-[11px] leading-tight text-brand-100">Agua ahorrada</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <Receipt className="h-4 w-4 text-brand-200" />
            <p className="mt-2 text-[17px] font-extrabold">{cop(order.savings)}</p>
            <p className="text-[11px] leading-tight text-brand-100">Tu ahorro</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button block to="/tienda/perfil" variant="outline" icon={<CalendarCheck className="h-4 w-4" />}>
          Ver mis pedidos
        </Button>
        <Button block to="/tienda/explorar" icon={<ShoppingBag className="h-4 w-4" />}>
          Seguir rescatando
        </Button>
      </div>

      <p className="text-center">
        <Badge tone="neutral">Compra simulada · prototipo académico</Badge>
      </p>
    </div>
  );
}
