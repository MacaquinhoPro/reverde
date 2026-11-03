import type {
  Category,
  Order,
  OrderItem,
  Product,
  PromoOutcome,
  Sale,
  User,
} from '../../src/types';
import { addDays } from '../../src/lib/format';

let seq = 0;
/** Ids estables y únicos dentro de un archivo de pruebas. */
export const nextId = (prefix = 'x'): string => `${prefix}-${++seq}`;

/** Producto de prueba: bajo riesgo por defecto, se ajusta con `patch`. */
export function makeProduct(patch: Partial<Product> = {}): Product {
  return {
    id: nextId('p'),
    name: 'Yogur natural',
    description: 'Yogur natural de prueba.',
    category: 'Lácteos',
    emoji: '🥛',
    image: 'from-white to-white',
    photo: '/img/productos/yogur.jpg',
    quantity: 10,
    unit: 'unidad',
    weightPerUnitKg: 0.2,
    entryDate: addDays(-3),
    expiryDate: addDays(12),
    originalPrice: 4500,
    discountPercent: 0,
    establishmentId: 'sup-1',
    status: 'en_inventario',
    dailySales: 6,
    demandTrend: 0,
    createdBy: 'seed',
    ...patch,
  };
}

export function makeSale(patch: Partial<Sale> = {}): Sale {
  const qty = patch.qty ?? 2;
  const originalPrice = patch.originalPrice ?? 5000;
  const soldPrice = patch.soldPrice ?? 3000;
  return {
    id: nextId('s'),
    date: addDays(-1),
    productId: nextId('p'),
    productName: 'Yogur natural',
    emoji: '🥛',
    establishmentId: 'sup-1',
    customer: 'Sofía Herrera',
    qty,
    originalPrice,
    soldPrice,
    discountPercent: Math.round((1 - soldPrice / originalPrice) * 100),
    recovered: soldPrice * qty,
    wasteAvoidedKg: 0.4 * qty,
    channel: 'marketplace',
    ...patch,
  };
}

export function makeOrderItem(patch: Partial<OrderItem> = {}): OrderItem {
  return {
    productId: nextId('p'),
    name: 'Yogur natural',
    emoji: '🥛',
    image: 'from-white to-white',
    qty: 2,
    unitOriginalPrice: 4500,
    unitPrice: 2950,
    establishmentId: 'sup-1',
    weightKg: 0.4,
    ...patch,
  };
}

export function makeOrder(patch: Partial<Order> = {}): Order {
  const items = patch.items ?? [makeOrderItem()];
  return {
    id: nextId('o'),
    code: 'RV-TEST1',
    userId: 'u-cli-1',
    userName: 'Sofía Herrera',
    createdAt: new Date().toISOString(),
    mode: 'compra',
    payment: 'tarjeta',
    items,
    total: items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
    savings: items.reduce((s, i) => s + (i.unitOriginalPrice - i.unitPrice) * i.qty, 0),
    wasteAvoidedKg: +items.reduce((s, i) => s + i.weightKg, 0).toFixed(2),
    establishmentIds: [...new Set(items.map((i) => i.establishmentId))],
    status: 'confirmado',
    pickupWindow: 'Hoy, 12:00 – 21:00',
    ...patch,
  };
}

export function makePromo(patch: Partial<PromoOutcome> = {}): PromoOutcome {
  return {
    id: nextId('po'),
    category: 'Lácteos' as Category,
    discountPercent: 30,
    sellThrough: 80,
    daysToSell: 2,
    establishmentId: 'sup-1',
    date: addDays(-10),
    ...patch,
  };
}

export function makeUser(patch: Partial<User> = {}): User {
  return {
    id: 'u-sup-1',
    email: 'supermercado1@reverde.com',
    name: 'Laura Mendoza',
    role: 'supermercado',
    establishmentId: 'sup-1',
    ...patch,
  };
}
