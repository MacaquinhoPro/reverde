import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SEED_VERSION } from '../../src/lib/demoState';
import { save } from '../../src/lib/storage';
import { AppProvider, useApp } from '../../src/store/AppContext';
import { ConsentProvider } from '../../src/store/ConsentContext';
import { buildConsent, saveConsent } from '../../src/lib/consent';
import type { CartLine, Order, Product, PromoOutcome, Sale, User } from '../../src/types';

export type AppApi = ReturnType<typeof useApp>;

export interface SeedOptions {
  user?: User | null;
  products?: Product[];
  sales?: Sale[];
  orders?: Order[];
  promoOutcomes?: PromoOutcome[];
  cart?: CartLine[];
  dismissed?: Record<string, string>;
  appliedRecs?: string[];
  /** Por defecto las pruebas arrancan con el habeas data ya autorizado. */
  consent?: boolean;
}

/** Mismo formato de día local que usa `demoState`. */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Siembra `localStorage` con un estado controlado y lo marca como generado hoy,
 * para que `loadDemoState` no resiembre ni reancle fechas durante la prueba.
 */
export function seedStorage(o: SeedOptions = {}): void {
  save('seedVersion', SEED_VERSION);
  save('anchorDay', todayKey());
  save('user', o.user ?? null);
  save('products', o.products ?? []);
  save('sales', o.sales ?? []);
  save('orders', o.orders ?? []);
  save('promoOutcomes', o.promoOutcomes ?? []);
  save('cart', o.cart ?? []);
  save('dismissed', o.dismissed ?? {});
  save('appliedRecs', o.appliedRecs ?? []);
  if (o.consent ?? true) {
    saveConsent(buildConsent({ terms: true, dataProcessing: true, marketing: false }));
  }
}

/** Renderiza `ui` dentro del provider y un router en memoria. */
export function renderWithApp(ui: ReactNode, o: SeedOptions = {}, initialPath = '/'): RenderResult {
  seedStorage(o);
  return render(
    <ConsentProvider>
      <AppProvider>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </AppProvider>
    </ConsentProvider>,
  );
}

/**
 * Expone la API del store para probarla directamente.
 * `api()` siempre devuelve el valor del último render (las mutaciones deben
 * envolverse en `act`).
 */
export function renderApi(o: SeedOptions = {}): { api: () => AppApi } & RenderResult {
  seedStorage(o);
  const ref: { current: AppApi | null } = { current: null };

  function Probe() {
    ref.current = useApp();
    return null;
  }

  const utils = render(
    <ConsentProvider>
      <AppProvider>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </AppProvider>
    </ConsentProvider>,
  );

  return {
    ...utils,
    api: () => {
      if (!ref.current) throw new Error('El provider no se montó');
      return ref.current;
    },
  };
}

/** Igual que `renderApi` pero devolviendo además el valor de un hook. */
export function renderHookWithApp<T>(hook: () => T, o: SeedOptions = {}): { result: () => T; api: () => AppApi } {
  seedStorage(o);
  const ref: { current: T | null } = { current: null };
  const apiRef: { current: AppApi | null } = { current: null };

  function Probe() {
    apiRef.current = useApp();
    ref.current = hook();
    return null;
  }

  render(
    <ConsentProvider>
      <AppProvider>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </AppProvider>
    </ConsentProvider>,
  );

  return {
    result: () => {
      if (ref.current === null) throw new Error('El hook no devolvió valor');
      return ref.current;
    },
    api: () => {
      if (!apiRef.current) throw new Error('El provider no se montó');
      return apiRef.current;
    },
  };
}
