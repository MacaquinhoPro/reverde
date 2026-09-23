import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Eye, EyeOff, Leaf, LogIn, ShieldCheck, Store, User as UserIcon, Utensils } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Card } from '../components/ui/Primitives';
import { DEMO_PASSWORD, QUICK_ACCESS, USERS } from '../data/users';
import { byEstablishment } from '../data/establishments';
import { useApp } from '../store/AppContext';
import { homeForRole } from '../lib/routes';
import { cx } from '../lib/format';
import type { Role } from '../types';

const ROLE_ICON: Record<Role, typeof Store> = {
  supermercado: Store,
  restaurante: Utensils,
  cliente: UserIcon,
  superadmin: ShieldCheck,
};

const ROLE_LABEL: Record<Role, string> = {
  supermercado: 'Supermercados',
  restaurante: 'Restaurantes',
  cliente: 'Clientes',
  superadmin: 'Superadmin',
};

export default function Login() {
  const [params] = useSearchParams();
  const initialRole = (params.get('rol') as Role) || 'supermercado';
  const [tab, setTab] = useState<Role>(
    (['supermercado', 'restaurante', 'cliente', 'superadmin'] as Role[]).includes(initialRole)
      ? initialRole
      : 'supermercado',
  );
  const [email, setEmail] = useState('supermercado1@reverde.com');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, toast } = useApp();
  const navigate = useNavigate();

  const accounts = useMemo(() => USERS.filter((u) => u.role === tab), [tab]);

  const doLogin = (mail: string) => {
    const res = login(mail, DEMO_PASSWORD);
    if (res.ok && res.user) {
      toast({ title: `Hola, ${res.user.name.split(' ')[0]}`, description: 'Sesión iniciada en Reverde.' });
      navigate(homeForRole(res.user.role));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const res = login(email, password);
    if (!res.ok) {
      setError(res.error ?? 'No fue posible iniciar sesión.');
      return;
    }
    setError(null);
    if (res.user) {
      toast({ title: `Hola, ${res.user.name.split(' ')[0]}`, description: 'Sesión iniciada en Reverde.' });
      navigate(homeForRole(res.user.role));
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Columna de marca ─────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-brand-700 p-12 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-800/70 blur-3xl" />
        <div className="relative">
          <Link to="/">
            <Logo size="md" tone="light" />
          </Link>
        </div>
        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-semibold backdrop-blur">
            <Leaf className="h-3.5 w-3.5" /> B2B2C
          </span>
          <h2 className="mt-6 text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em]">
            Una segunda oportunidad para cada alimento.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100">
            Reverde detecta qué alimentos tienen riesgo de convertirse en desperdicio, ayuda al
            establecimiento a decidir qué hacer con ellos y los conecta con compradores para recuperar
            valor antes de perderlos.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { v: '86,4 kg', l: 'Desperdicio evitado' },
              { v: '128', l: 'Productos rescatados' },
              { v: '76 %', l: 'Tasa de recuperación' },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/10 p-3.5 backdrop-blur">
                <p className="text-[19px] font-extrabold tracking-tight">{s.v}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-brand-200">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[12px] text-brand-200">Prototipo universitario · Datos simulados</p>
      </aside>

      {/* ── Formulario ───────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col bg-canvas">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-soft hover:text-brand-700 lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Inicio
          </Link>
          <Link to="/" className="hidden items-center gap-1.5 text-[13.5px] font-medium text-ink-soft hover:text-brand-700 lg:inline-flex">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-12 sm:px-8">
          <div className="lg:hidden">
            <Logo size="md" />
          </div>
          <h1 className="mt-6 text-[28px] font-extrabold tracking-[-0.03em] text-ink lg:mt-0">Ingresa a Reverde</h1>
          <p className="mt-2 text-[14.5px] text-ink-soft">
            Selecciona un rol para probar la demo o escribe una de las cuentas de prueba.
          </p>

          {/* Accesos rápidos */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {QUICK_ACCESS.map((q) => {
              const Icon = ROLE_ICON[q.role];
              return (
                <button
                  key={q.role}
                  onClick={() => doLogin(q.email)}
                  className="group flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-ink">{q.label.replace('Entrar como ', '')}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">{q.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-black/[0.07]" />
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">o con tu correo</span>
            <span className="h-px flex-1 bg-black/[0.07]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Correo electrónico">
              <Input
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="tucorreo@reverde.com"
              />
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p className="rounded-xl bg-[#FCEDEC] px-3.5 py-2.5 text-[13px] font-medium text-[#B4453D]">{error}</p>
            )}

            <Button type="submit" block size="lg" icon={<LogIn className="h-4 w-4" />}>
              Iniciar sesión
            </Button>
          </form>

          {/* Cuentas demo */}
          <Card className="mt-7 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-ink">Cuentas de demostración</p>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11.5px] font-bold text-brand-700">
                Demo1234
              </span>
            </div>

            <div className="mt-3 flex gap-1 overflow-x-auto no-scrollbar">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setTab(r)}
                  className={cx(
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                    tab === r ? 'bg-brand-700 text-white' : 'text-ink-soft hover:bg-brand-50',
                  )}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>

            <ul className="mt-3 space-y-1.5">
              {accounts.map((a) => {
                const est = byEstablishment(a.establishmentId);
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(null); }}
                      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-brand-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">{a.email}</span>
                        <span className="block truncate text-[11.5px] text-ink-faint">
                          {a.name}{est ? ` · ${est.name}` : ''}
                        </span>
                      </span>
                      <Copy className="h-3.5 w-3.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <p className="mt-6 text-center text-[12.5px] text-ink-faint">
            ¿Solo quieres ver el marketplace?{' '}
            <Link to="/tienda" className="font-semibold text-brand-700 hover:underline">
              Explorar sin iniciar sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
