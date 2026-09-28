import type { Order, Product, PromoOutcome, Sale, User, CartLine } from '../types';
import { buildSeedProducts } from '../data/products';
import { buildSeedPromoOutcomes, buildSeedSales } from '../data/history';
import { load, resetAll, save } from './storage';

/**
 * Versión de los datos semilla. **Súbela cada vez que cambies `catalog.ts`,
 * `products.ts` o `history.ts`**: al abrir la app, si la versión guardada en
 * el navegador no coincide, la demo se vuelve a sembrar sola. Así nadie tiene
 * que entrar a *Perfil → Reiniciar datos* después de un despliegue.
 */
export const SEED_VERSION = 2;

export interface DemoState {
  user: User | null;
  products: Product[];
  sales: Sale[];
  orders: Order[];
  promoOutcomes: PromoOutcome[];
  cart: CartLine[];
  dismissed: Record<string, string>;
  appliedRecs: string[];
}

/** Estado inicial de la demo, recién generado a partir de las semillas. */
export function buildSeed(): Omit<DemoState, 'user'> {
  return {
    products: buildSeedProducts(),
    sales: buildSeedSales(),
    orders: [],
    promoOutcomes: buildSeedPromoOutcomes(),
    cart: [],
    dismissed: {},
    appliedRecs: [],
  };
}

/* ── Anclaje temporal ───────────────────────────────────────────────────────
 * Las semillas usan fechas relativas ("vence en 2 días"), pero al guardarse en
 * localStorage quedan congeladas: al día siguiente medio inventario aparece
 * vencido y las gráficas de 60 días se corren. Guardamos el día en que se
 * generaron y, cuando cambia la fecha, desplazamos las fechas de los datos
 * simulados los días transcurridos. Lo que creó la persona usuaria (sus
 * productos, sus compras) conserva su fecha real.
 * ────────────────────────────────────────────────────────────────────────── */

/** Día local en formato AAAA-MM-DD (no UTC: la demo se vive en hora local). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(anchor: string): number {
  const [y, m, d] = anchor.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const from = new Date(y, m - 1, d, 12, 0, 0, 0);
  const [ty, tm, td] = today().split('-').map(Number);
  const to = new Date(ty, tm - 1, td, 12, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function shift(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Corre las fechas de los datos simulados para que "hoy" siga siendo hoy. */
function rebase(state: DemoState, days: number): DemoState {
  return {
    ...state,
    products: state.products.map((p) =>
      p.createdBy === 'seed'
        ? { ...p, entryDate: shift(p.entryDate, days), expiryDate: shift(p.expiryDate, days) }
        : p,
    ),
    sales: state.sales.map((s) => (s.seed ? { ...s, date: shift(s.date, days) } : s)),
    promoOutcomes: state.promoOutcomes.map((o) => (o.seed ? { ...o, date: shift(o.date, days) } : o)),
    // Los silenciamientos vencidos ya no aportan: se limpian al cambiar de día.
    dismissed: Object.fromEntries(
      Object.entries(state.dismissed).filter(([, until]) => new Date(until) > new Date()),
    ),
  };
}

/** Marca el estado actual como generado hoy y con la versión de semilla vigente. */
export function stampFresh(): void {
  save('seedVersion', SEED_VERSION);
  save('anchorDay', today());
}

/**
 * Lee el estado persistido y lo deja utilizable:
 * resiembra si cambió la versión y reancla las fechas si cambió el día.
 */
export function loadDemoState(): DemoState {
  const user = load<User | null>('user', null);

  if (load<number>('seedVersion', 0) !== SEED_VERSION) {
    resetAll();
    const fresh: DemoState = { user, ...buildSeed() };
    save('user', user);
    stampFresh();
    return fresh;
  }

  const seed = buildSeed();
  const stored: DemoState = {
    user,
    products: load('products', seed.products),
    sales: load('sales', seed.sales),
    orders: load<Order[]>('orders', []),
    promoOutcomes: load('promoOutcomes', seed.promoOutcomes),
    cart: load<CartLine[]>('cart', []),
    dismissed: load<Record<string, string>>('dismissed', {}),
    appliedRecs: load<string[]>('appliedRecs', []),
  };

  const elapsed = daysSince(load<string>('anchorDay', today()));
  if (elapsed <= 0) return stored;

  const rebased = rebase(stored, elapsed);
  save('products', rebased.products);
  save('sales', rebased.sales);
  save('promoOutcomes', rebased.promoOutcomes);
  save('dismissed', rebased.dismissed);
  save('anchorDay', today());
  return rebased;
}
