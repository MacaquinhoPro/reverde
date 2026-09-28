import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ActionType,
  CartLine,
  Order,
  OrderMode,
  PaymentMethod,
  Product,
  PromoOutcome,
  Sale,
  Toast,
  User,
} from '../types';
import { DEMO_PASSWORD, findUserByEmail } from '../data/users';
import { CATALOG } from '../data/catalog';
import { computeRisk, finalPrice } from '../lib/ai';
import { addDays, orderCode, qtyLabel, uid } from '../lib/format';
import { resetAll, save } from '../lib/storage';
import { buildSeed, loadDemoState, stampFresh } from '../lib/demoState';

interface AppState {
  user: User | null;
  products: Product[];
  sales: Sale[];
  orders: Order[];
  promoOutcomes: PromoOutcome[];
  cart: CartLine[];
  dismissed: Record<string, string>;
  appliedRecs: string[];
  toasts: Toast[];
}

interface AppApi extends AppState {
  login: (email: string, password: string) => { ok: boolean; error?: string; user?: User };
  logout: () => void;
  resetDemo: () => void;

  addProduct: (p: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  applyDiscount: (id: string, percent: number) => void;
  setPublished: (id: string, published: boolean) => void;
  applyRecommendation: (id: string, action: ActionType, discount: number) => string;
  dismissAlert: (productId: string, hours?: number) => void;

  addToCart: (productId: string, qty?: number) => void;
  setCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  checkout: (mode: OrderMode, payment: PaymentMethod) => Order | null;

  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;

  productById: (id?: string) => Product | undefined;
  availableStock: (id: string) => number;
  cartCount: number;
}

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Una sola lectura del almacenamiento: resiembra si cambiaron las semillas y
  // reancla las fechas simuladas si pasaron días desde la última visita.
  const initial = useMemo(() => loadDemoState(), []);

  const [user, setUser] = useState<User | null>(initial.user);
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [sales, setSales] = useState<Sale[]>(initial.sales);
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [promoOutcomes, setPromoOutcomes] = useState<PromoOutcome[]>(initial.promoOutcomes);
  const [cart, setCart] = useState<CartLine[]>(initial.cart);
  const [dismissed, setDismissed] = useState<Record<string, string>>(initial.dismissed);
  const [appliedRecs, setAppliedRecs] = useState<string[]>(initial.appliedRecs);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // El checkout puede ejecutarse después de un login inmediato (invitado que
  // compra): la ref mantiene el usuario vigente sin esperar al re-render.
  const userRef = useRef<User | null>(user);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => save('user', user), [user]);
  useEffect(() => save('products', products), [products]);
  useEffect(() => save('sales', sales), [sales]);
  useEffect(() => save('orders', orders), [orders]);
  useEffect(() => save('promoOutcomes', promoOutcomes), [promoOutcomes]);
  useEffect(() => save('cart', cart), [cart]);
  useEffect(() => save('dismissed', dismissed), [dismissed]);
  useEffect(() => save('appliedRecs', appliedRecs), [appliedRecs]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('t');
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const productById = useCallback((id?: string) => products.find((p) => p.id === id), [products]);

  const availableStock = useCallback(
    (id: string) => {
      const p = products.find((x) => x.id === id);
      if (!p) return 0;
      const reserved = cart.find((c) => c.productId === id)?.qty ?? 0;
      return Math.max(0, p.quantity - reserved);
    },
    [products, cart],
  );

  /* ── Autenticación simulada ─────────────────────────────────────────── */
  const login: AppApi['login'] = useCallback((email, password) => {
    const found = findUserByEmail(email);
    if (!found) return { ok: false, error: 'No encontramos una cuenta con ese correo.' };
    if (password !== DEMO_PASSWORD) return { ok: false, error: 'Contraseña incorrecta. Usa Demo1234.' };
    userRef.current = found;
    setUser(found);
    return { ok: true, user: found };
  }, []);

  const logout = useCallback(() => {
    userRef.current = null;
    setUser(null);
    setCart([]);
  }, []);

  const resetDemo = useCallback(() => {
    resetAll();
    stampFresh();
    const fresh = buildSeed();
    userRef.current = null;
    setUser(null);
    setProducts(fresh.products);
    setSales(fresh.sales);
    setOrders([]);
    setPromoOutcomes(fresh.promoOutcomes);
    setCart([]);
    setDismissed({});
    setAppliedRecs([]);
    toast({ title: 'Demo reiniciada', description: 'Se restauraron los datos originales.', tone: 'info' });
  }, [toast]);

  /* ── Inventario ─────────────────────────────────────────────────────── */
  const addProduct: AppApi['addProduct'] = useCallback(
    (p) => {
      const created: Product = { ...p, id: uid('p') };
      setProducts((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const updateProduct: AppApi['updateProduct'] = useCallback((id, patch) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deleteProduct: AppApi['deleteProduct'] = useCallback((id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((c) => c.productId !== id));
  }, []);

  const applyDiscount: AppApi['applyDiscount'] = useCallback((id, percent) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, discountPercent: Math.max(0, Math.min(80, percent)) } : p)),
    );
  }, []);

  const setPublished: AppApi['setPublished'] = useCallback((id, published) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: published ? 'publicado' : 'en_inventario' } : p,
      ),
    );
  }, []);

  const dismissAlert: AppApi['dismissAlert'] = useCallback((productId, hours = 24) => {
    setDismissed((prev) => ({ ...prev, [productId]: addDays(hours / 24) }));
  }, []);

  /** Ejecuta la acción sugerida por la IA y devuelve el mensaje de confirmación. */
  const applyRecommendation: AppApi['applyRecommendation'] = useCallback(
    (id, action, discount) => {
      const product = products.find((p) => p.id === id);
      if (!product) return 'Producto no encontrado';
      setAppliedRecs((prev) => (prev.includes(id) ? prev : [...prev, id]));

      switch (action) {
        case 'descuento':
          applyDiscount(id, discount);
          return `Descuento del ${discount} % aplicado a ${product.name}.`;
        case 'publicar':
          setPublished(id, true);
          return `${product.name} ya está visible en el marketplace.`;
        case 'combo':
          applyDiscount(id, Math.max(discount - 5, 15));
          updateProduct(id, { featured: true, status: 'publicado' });
          return `Combo creado: ${product.name} destacado con ${Math.max(discount - 5, 15)} % de descuento.`;
        case 'caja_rescate': {
          const boxQty = Math.max(1, Math.floor(product.quantity / 3));
          const box: Omit<Product, 'id'> = {
            ...product,
            name: `Caja de rescate · ${product.name}`,
            description: `Caja sorpresa con ${qtyLabel(boxQty * 3, product.unit)} de ${product.name.toLowerCase()} en excelente estado, rescatados antes de su vencimiento.`,
            category: 'Cajas de rescate',
            emoji: '🧺',
            image: CATALOG.cajaFrutas.image,
            photo: product.photo ?? CATALOG.cajaFrutas.photo,
            quantity: boxQty,
            unit: 'caja',
            weightPerUnitKg: product.weightPerUnitKg * 3,
            originalPrice: Math.round((product.originalPrice * 3) / 100) * 100,
            discountPercent: Math.max(discount, 40),
            status: 'publicado',
            isRescueBox: true,
            featured: true,
            createdBy: 'user',
          };
          addProduct(box);
          updateProduct(id, { quantity: Math.max(0, product.quantity - boxQty * 3) });
          return `Caja de rescate creada con ${boxQty} ${boxQty === 1 ? 'unidad' : 'unidades'} publicadas.`;
        }
        case 'destacar':
          updateProduct(id, { featured: true, status: 'publicado' });
          return `${product.name} destacado en el marketplace.`;
        case 'donar': {
          const donation: Sale = {
            id: uid('s'),
            date: new Date().toISOString(),
            productId: product.id,
            productName: product.name,
            emoji: product.emoji,
            photo: product.photo,
            customer: 'Banco de Alimentos',
            establishmentId: product.establishmentId,
            qty: product.quantity,
            originalPrice: product.originalPrice,
            soldPrice: 0,
            discountPercent: 100,
            recovered: 0,
            wasteAvoidedKg: +(product.quantity * product.weightPerUnitKg).toFixed(2),
            channel: 'tienda',
          };
          setSales((prev) => [donation, ...prev]);
          updateProduct(id, { quantity: 0, status: 'donado' });
          return `${product.name} donado: ${donation.wasteAvoidedKg} kg evitaron convertirse en desperdicio.`;
        }
        case 'venta_presencial':
          updateProduct(id, { featured: true });
          return `${product.name} marcado como prioridad de venta presencial.`;
        default:
          return 'Acción aplicada.';
      }
    },
    [products, applyDiscount, setPublished, updateProduct, addProduct],
  );

  /* ── Carrito ────────────────────────────────────────────────────────── */
  const addToCart: AppApi['addToCart'] = useCallback(
    (productId, qty = 1) => {
      setCart((prev) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return prev;
        const existing = prev.find((c) => c.productId === productId);
        const nextQty = Math.min((existing?.qty ?? 0) + qty, product.quantity);
        if (existing) return prev.map((c) => (c.productId === productId ? { ...c, qty: nextQty } : c));
        return [...prev, { productId, qty: nextQty }];
      });
    },
    [products],
  );

  const setCartQty: AppApi['setCartQty'] = useCallback(
    (productId, qty) => {
      setCart((prev) => {
        const product = products.find((p) => p.id === productId);
        const capped = Math.max(0, Math.min(qty, product?.quantity ?? 0));
        if (capped === 0) return prev.filter((c) => c.productId !== productId);
        return prev.map((c) => (c.productId === productId ? { ...c, qty: capped } : c));
      });
    },
    [products],
  );

  const removeFromCart: AppApi['removeFromCart'] = useCallback((productId) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  /* ── Checkout simulado ──────────────────────────────────────────────── */
  const checkout: AppApi['checkout'] = useCallback(
    (mode, payment) => {
      const activeUser = userRef.current;
      if (!activeUser || cart.length === 0) return null;
      const now = new Date().toISOString();
      const lines = cart
        .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
        .filter((x): x is { line: CartLine; product: Product } => Boolean(x.product));
      if (lines.length === 0) return null;

      const items = lines.map(({ line, product }) => ({
        productId: product.id,
        name: product.name,
        emoji: product.emoji,
        image: product.image,
        photo: product.photo,
        qty: line.qty,
        unitOriginalPrice: product.originalPrice,
        unitPrice: finalPrice(product),
        establishmentId: product.establishmentId,
        weightKg: +(product.weightPerUnitKg * line.qty).toFixed(2),
      }));

      const total = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
      const savings = items.reduce((s, i) => s + (i.unitOriginalPrice - i.unitPrice) * i.qty, 0);
      const wasteAvoidedKg = +items.reduce((s, i) => s + i.weightKg, 0).toFixed(2);

      const order: Order = {
        id: uid('o'),
        code: orderCode(),
        userId: activeUser.id,
        userName: activeUser.name,
        createdAt: now,
        mode,
        payment,
        items,
        total,
        savings,
        wasteAvoidedKg,
        establishmentIds: [...new Set(items.map((i) => i.establishmentId))],
        status: mode === 'reserva' ? 'reservado' : 'confirmado',
        pickupWindow: mode === 'reserva' ? 'Hoy, 17:00 – 20:00' : 'Hoy, 12:00 – 21:00',
      };

      // Las ventas alimentan las métricas de impacto del establecimiento.
      const newSales: Sale[] = lines.map(({ line, product }) => ({
        id: uid('s'),
        date: now,
        productId: product.id,
        productName: product.name,
        emoji: product.emoji,
        photo: product.photo,
        customer: activeUser.name,
        establishmentId: product.establishmentId,
        qty: line.qty,
        originalPrice: product.originalPrice,
        soldPrice: finalPrice(product),
        discountPercent: product.discountPercent,
        recovered: finalPrice(product) * line.qty,
        wasteAvoidedKg: +(product.weightPerUnitKg * line.qty).toFixed(2),
        channel: 'marketplace',
      }));

      // El sistema aprende: registra el resultado real de cada promoción vendida.
      const outcomes: PromoOutcome[] = lines
        .filter(({ product }) => product.discountPercent > 0)
        .map(({ line, product }) => ({
          id: uid('po'),
          category: product.category,
          discountPercent: product.discountPercent,
          sellThrough: Math.min(100, Math.round((line.qty / Math.max(product.quantity, 1)) * 100) + 55),
          daysToSell: Math.max(1, computeRisk(product).daysLeft),
          establishmentId: product.establishmentId,
          date: now,
        }));

      setProducts((prev) =>
        prev.map((p) => {
          const line = cart.find((c) => c.productId === p.id);
          if (!line) return p;
          const remaining = Math.max(0, p.quantity - line.qty);
          return { ...p, quantity: remaining, status: remaining === 0 ? 'agotado' : p.status };
        }),
      );
      setSales((prev) => [...newSales, ...prev]);
      setPromoOutcomes((prev) => [...outcomes, ...prev]);
      setOrders((prev) => [order, ...prev]);
      setCart([]);
      return order;
    },
    [cart, products],
  );

  const value: AppApi = {
    user, products, sales, orders, promoOutcomes, cart, dismissed, appliedRecs, toasts,
    login, logout, resetDemo,
    addProduct, updateProduct, deleteProduct, applyDiscount, setPublished, applyRecommendation, dismissAlert,
    addToCart, setCartQty, removeFromCart, clearCart,
    checkout,
    toast, dismissToast,
    productById, availableStock,
    cartCount: cart.reduce((s, c) => s + c.qty, 0),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
