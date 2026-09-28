import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Building2, CalendarCheck, CreditCard, Leaf, Lock, ShieldCheck } from 'lucide-react';
import type { OrderMode, PaymentMethod } from '../../types';
import { useApp } from '../../store/AppContext';
import { byEstablishment } from '../../data/establishments';
import { finalPrice } from '../../lib/ai';
import { cop, cx, kg } from '../../lib/format';
import { Card, EmptyState, ProductThumb, SectionTitle } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { DEMO_PASSWORD } from '../../data/users';

const METHODS: { id: PaymentMethod; label: string; hint: string; icon: typeof CreditCard }[] = [
  { id: 'tarjeta', label: 'Tarjeta de crédito o débito', hint: 'Visa, Mastercard, Amex', icon: CreditCard },
  { id: 'pse', label: 'PSE', hint: 'Débito desde tu banco', icon: Building2 },
  { id: 'establecimiento', label: 'Pagar en el establecimiento', hint: 'Al recoger tu pedido', icon: Banknote },
];

const BANKS = ['Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Nequi'];

export default function Checkout() {
  const [params] = useSearchParams();
  const initialMode: OrderMode = params.get('modo') === 'reserva' ? 'reserva' : 'compra';
  const { cart, products, checkout, user, login, toast } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<OrderMode>(initialMode);
  const [method, setMethod] = useState<PaymentMethod>(initialMode === 'reserva' ? 'establecimiento' : 'tarjeta');
  const [card, setCard] = useState({ number: '4242 4242 4242 4242', name: 'Sofía Herrera', exp: '12/28', cvv: '123' });
  const [bank, setBank] = useState(BANKS[0]);
  const [processing, setProcessing] = useState(false);

  const lines = cart
    .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
    .filter((x): x is { line: typeof cart[number]; product: NonNullable<typeof x.product> } => Boolean(x.product));

  const subtotal = lines.reduce((s, { line, product }) => s + finalPrice(product) * line.qty, 0);
  const original = lines.reduce((s, { line, product }) => s + product.originalPrice * line.qty, 0);
  const savings = original - subtotal;
  const impactKg = lines.reduce((s, { line, product }) => s + product.weightPerUnitKg * line.qty, 0);
  const establishments = [...new Set(lines.map(({ product }) => product.establishmentId))];

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<Leaf className="h-5 w-5" />}
        title="No hay nada por pagar"
        description="Agrega productos al carrito para completar tu compra."
        action={<Button size="sm" to="/tienda/explorar">Ir al marketplace</Button>}
      />
    );
  }

  const confirm = () => {
    if (!user) {
      const res = login('cliente1@reverde.com', DEMO_PASSWORD);
      if (!res.ok) return;
      toast({ title: 'Sesión iniciada como cliente demo', tone: 'info' });
    }
    setProcessing(true);
    // Simulación de pasarela de pago: no hay proveedor real conectado.
    setTimeout(() => {
      const order = checkout(mode, method);
      setProcessing(false);
      if (order) navigate(`/tienda/confirmacion/${order.id}`);
    }, 1200);
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/tienda/carrito')}>
        Volver al carrito
      </Button>

      <SectionTitle title="Finalizar pedido" subtitle="Simulación de pago · no se procesa ningún cobro real." />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {/* Modo */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-[15px] font-bold text-ink">¿Cómo quieres recibirlo?</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {([
                { id: 'compra' as OrderMode, title: 'Comprar ahora', body: 'Pagas en línea y recoges hoy mismo.' },
                { id: 'reserva' as OrderMode, title: 'Reservar', body: 'Apartas el producto y pagas al recogerlo.' },
              ]).map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setMode(o.id);
                    if (o.id === 'reserva') setMethod('establecimiento');
                  }}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition-all duration-200',
                    mode === o.id ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100' : 'border-black/10 hover:border-brand-300',
                  )}
                >
                  <p className="text-[14px] font-bold text-ink">{o.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{o.body}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Pago */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-[15px] font-bold text-ink">Método de pago</h3>
            <div className="mt-3 space-y-2">
              {METHODS.map((m) => {
                const disabled = mode === 'reserva' && m.id !== 'establecimiento';
                return (
                  <button
                    key={m.id}
                    disabled={disabled}
                    onClick={() => setMethod(m.id)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200',
                      method === m.id ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100' : 'border-black/10 hover:border-brand-300',
                      disabled && 'pointer-events-none opacity-40',
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-soft">
                      <m.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-ink">{m.label}</span>
                      <span className="block text-[12px] text-ink-soft">{m.hint}</span>
                    </span>
                    <span className={cx('h-4 w-4 shrink-0 rounded-full border-2', method === m.id ? 'border-brand-700 bg-brand-700 ring-2 ring-white' : 'border-black/15')} />
                  </button>
                );
              })}
            </div>

            {method === 'tarjeta' && (
              <div className="mt-4 grid animate-fade-in gap-3 sm:grid-cols-2">
                <Field label="Número de tarjeta" className="sm:col-span-2">
                  <Input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} inputMode="numeric" />
                </Field>
                <Field label="Nombre en la tarjeta" className="sm:col-span-2">
                  <Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
                </Field>
                <Field label="Vencimiento">
                  <Input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/AA" />
                </Field>
                <Field label="CVV">
                  <Input value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} inputMode="numeric" />
                </Field>
              </div>
            )}

            {method === 'pse' && (
              <div className="mt-4 animate-fade-in space-y-3">
                <Field label="Banco">
                  <Select value={bank} onChange={(e) => setBank(e.target.value)}>
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Tipo de persona">
                  <Select defaultValue="natural">
                    <option value="natural">Persona natural</option>
                    <option value="juridica">Persona jurídica</option>
                  </Select>
                </Field>
              </div>
            )}

            {method === 'establecimiento' && (
              <div className="mt-4 animate-fade-in rounded-2xl bg-brand-50 p-4">
                <p className="inline-flex items-center gap-2 text-[13px] font-bold text-brand-700">
                  <CalendarCheck className="h-4 w-4" /> Pago al recoger
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  Tu pedido queda apartado hasta el cierre del establecimiento. Muestra el código de tu reserva al
                  llegar y paga allí mismo.
                </p>
              </div>
            )}

            <p className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint">
              <Lock className="h-3 w-3" /> Prototipo académico: los datos de pago no se envían a ningún servicio.
            </p>
          </Card>

          {/* Recogida */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-[15px] font-bold text-ink">Punto de recogida</h3>
            <ul className="mt-3 space-y-2.5">
              {establishments.map((id) => {
                const est = byEstablishment(id);
                return (
                  <li key={id} className="flex items-start gap-3 rounded-xl border border-black/5 p-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
                      style={{ background: `hsl(${est?.logoHue ?? 152} 42% 92%)`, color: `hsl(${est?.logoHue ?? 152} 45% 28%)` }}
                    >
                      {est?.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-ink">{est?.name}</p>
                      <p className="text-[12.5px] text-ink-soft">{est?.address}, {est?.city}</p>
                      <p className="text-[12px] text-ink-faint">{est?.schedule}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* Resumen */}
        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-4 sm:p-5">
            <h3 className="text-[15px] font-bold text-ink">Tu pedido</h3>
            <ul className="mt-3 space-y-2.5">
              {lines.map(({ line, product }) => (
                <li key={product.id} className="flex items-center gap-3">
                  <ProductThumb emoji={product.emoji} image={product.image} photo={product.photo} alt={product.name} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{product.name}</p>
                    <p className="text-[11.5px] text-ink-soft">{line.qty} × {cop(finalPrice(product))}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold text-ink">{cop(finalPrice(product) * line.qty)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-black/5 pt-4 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Precio original</dt>
                <dd className="text-ink-faint line-through">{cop(original)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Ahorro Reverde</dt>
                <dd className="font-bold text-risk-low">−{cop(savings)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Alimentos rescatados</dt>
                <dd className="font-bold text-ink">{kg(impactKg)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-brand-50 p-4">
              <span className="text-[13px] font-semibold text-ink">
                {mode === 'reserva' ? 'Pagarás en el local' : 'Total a pagar'}
              </span>
              <span className="text-[24px] font-extrabold tracking-tight text-brand-700">{cop(subtotal)}</span>
            </div>

            <Button
              block
              size="lg"
              className="mt-4"
              disabled={processing}
              icon={processing ? undefined : <ShieldCheck className="h-4 w-4" />}
              onClick={confirm}
            >
              {processing
                ? 'Procesando pago…'
                : mode === 'reserva'
                  ? 'Confirmar reserva'
                  : `Pagar ${cop(subtotal)}`}
            </Button>

            {!user && (
              <p className="mt-2.5 text-center text-[11.5px] text-ink-faint">
                Entrarás automáticamente con la cuenta demo cliente1@reverde.com
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
