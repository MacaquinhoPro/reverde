/**
 * Traducción de filas de la base de datos a los DTO que ya consume el
 * frontend. Es la pieza que permite cambiar el almacenamiento sin tocar los
 * componentes: los nombres y los tipos que salen por la API son exactamente
 * los de `src/types.ts` del cliente.
 */
import type {
  Establishment,
  ExpirationAlert,
  Inventory,
  Order,
  OrderItem,
  Product,
  PromoOutcome,
  Recommendation,
  Sale,
  User,
  EstablishmentUser,
  Payment,
  Notification,
} from '@prisma/client';
import { computeRisk, finalPrice, type ComputedRisk } from './risk.ts';

export type ProductWithStock = Product & { inventory?: Inventory | null };

/** Stock disponible para vender = físico − reservado por órdenes pendientes. */
export const availableOf = (p: ProductWithStock): number =>
  Math.max(0, (p.inventory?.quantity ?? 0) - (p.inventory?.reservedQuantity ?? 0));

export const riskInputOf = (p: ProductWithStock, quantity = availableOf(p)) => ({
  name: p.name,
  category: p.category,
  unit: p.unit as string,
  quantity,
  dailySales: p.dailySales,
  demandTrend: p.demandTrend,
  discountPercent: p.discountPercent,
  expiryDate: p.expiryDate,
  status: p.status as string,
});

export interface ProductDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  image: string;
  photo?: string;
  /** Cantidad vendible. El frontend ya la trata como el stock a mostrar. */
  quantity: number;
  /** Stock físico en bodega, incluido lo reservado. */
  onHandQuantity: number;
  reservedQuantity: number;
  unit: string;
  weightPerUnitKg: number;
  entryDate: string;
  expiryDate: string;
  originalPrice: number;
  price: number;
  discountPercent: number;
  establishmentId: string;
  status: string;
  dailySales: number;
  demandTrend: number;
  featured: boolean;
  isRescueBox: boolean;
  createdBy: string;
  risk?: ComputedRisk;
}

export function productDTO(p: ProductWithStock, opts: { risk?: boolean } = {}): ProductDTO {
  const available = availableOf(p);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    emoji: p.emoji,
    image: p.image,
    photo: p.photo ?? undefined,
    quantity: available,
    onHandQuantity: p.inventory?.quantity ?? 0,
    reservedQuantity: p.inventory?.reservedQuantity ?? 0,
    unit: p.unit as string,
    weightPerUnitKg: p.weightPerUnitKg,
    entryDate: p.entryDate.toISOString(),
    expiryDate: p.expiryDate.toISOString(),
    originalPrice: p.originalPrice,
    price: finalPrice(p.originalPrice, p.discountPercent),
    discountPercent: p.discountPercent,
    establishmentId: p.establishmentId,
    status: p.status as string,
    dailySales: p.dailySales,
    demandTrend: p.demandTrend,
    featured: p.featured,
    isRescueBox: p.isRescueBox,
    createdBy: p.origin as string,
    risk: opts.risk ? computeRisk(riskInputOf(p, available)) : undefined,
  };
}

export const establishmentDTO = (e: Establishment) => ({
  id: e.id,
  slug: e.slug,
  name: e.name,
  type: e.type as string,
  address: e.address,
  city: e.city,
  logoHue: e.logoHue,
  rating: e.rating,
  x: e.mapX,
  y: e.mapY,
  latitude: e.latitude,
  longitude: e.longitude,
  distanceKm: e.distanceKm,
  status: e.status as string,
  joinedAt: e.joinedAt.toISOString(),
  schedule: e.schedule,
});

export type UserWithMemberships = User & { memberships?: Pick<EstablishmentUser, 'establishmentId'>[] };

export const userDTO = (u: UserWithMemberships) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role as string,
  status: u.status as string,
  establishmentId: u.memberships?.[0]?.establishmentId,
  avatarHue: u.avatarHue,
  emailVerified: u.emailVerifiedAt !== null,
  isDemo: u.isDemo,
  createdAt: u.createdAt.toISOString(),
});

export type OrderWithItems = Order & {
  items: OrderItem[];
  user?: Pick<User, 'name' | 'email'> | null;
  payments?: Payment[];
};

/**
 * `status` conserva los tres valores que el frontend ya pintaba
 * (confirmado · reservado · entregado) y se deriva del pago y del estado
 * logístico. `paymentStatus` expone el ciclo real del cobro.
 */
function uiStatus(o: Order): 'confirmado' | 'reservado' | 'entregado' {
  if (o.fulfillmentStatus === 'entregado') return 'entregado';
  if (o.status === 'PAID' && o.mode === 'compra') return 'confirmado';
  if (o.mode === 'reserva') return 'reservado';
  return o.status === 'PAID' ? 'confirmado' : 'reservado';
}

export const orderDTO = (o: OrderWithItems) => {
  const payment = o.payments?.[0];
  return {
    id: o.id,
    code: o.code,
    userId: o.userId,
    userName: o.user?.name ?? '',
    createdAt: o.createdAt.toISOString(),
    mode: o.mode as string,
    payment: o.paymentMethod as string,
    items: o.items.map((i) => ({
      productId: i.productId ?? '',
      name: i.name,
      emoji: i.emoji,
      image: i.image,
      photo: i.photo ?? undefined,
      qty: i.quantity,
      unitOriginalPrice: i.unitOriginalPrice,
      unitPrice: i.unitPrice,
      establishmentId: i.establishmentId,
      weightKg: i.weightKg,
    })),
    total: o.totalCop,
    savings: o.savingsCop,
    wasteAvoidedKg: o.wasteAvoidedKg,
    establishmentIds: [...new Set(o.items.map((i) => i.establishmentId))],
    status: uiStatus(o),
    paymentStatus: o.status as string,
    pickupWindow: o.pickupWindow,
    consent:
      o.consentVersion && o.consentAcceptedAt
        ? {
            version: o.consentVersion,
            acceptedAt: o.consentAcceptedAt.toISOString(),
            purpose: o.consentPurpose ?? '',
          }
        : undefined,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    paidAt: o.paidAt?.toISOString() ?? null,
    checkout: payment
      ? {
          paymentId: payment.id,
          provider: payment.provider as string,
          reference: payment.reference,
          status: payment.status as string,
          checkoutUrl: payment.checkoutUrl,
          amountInCents: payment.amountInCents,
          currency: payment.currency,
        }
      : null,
  };
};

export const saleDTO = (s: Sale) => ({
  id: s.id,
  date: s.occurredAt.toISOString(),
  productId: s.productId ?? '',
  productName: s.productName,
  emoji: s.emoji,
  photo: s.photo ?? undefined,
  customer: s.customerName,
  establishmentId: s.establishmentId,
  qty: s.quantity,
  originalPrice: s.originalPrice,
  soldPrice: s.soldPrice,
  discountPercent: s.discountPercent,
  recovered: s.recovered,
  wasteAvoidedKg: s.wasteAvoidedKg,
  channel: s.channel as string,
  category: s.category,
});

export const promoOutcomeDTO = (p: PromoOutcome) => ({
  id: p.id,
  category: p.category,
  discountPercent: p.discountPercent,
  sellThrough: p.sellThrough,
  daysToSell: p.daysToSell,
  establishmentId: p.establishmentId,
  date: p.occurredAt.toISOString(),
});

export const alertDTO = (a: ExpirationAlert) => ({
  id: a.id,
  productId: a.productId,
  establishmentId: a.establishmentId,
  level: a.level as string,
  title: a.title,
  body: a.body,
  riskScore: a.riskScore,
  wasteProbability: a.wasteProbability,
  status: a.status as string,
  createdAt: a.createdAt.toISOString(),
  dismissedUntil: a.snoozedUntil?.toISOString(),
  resolved: a.status === 'resuelta',
});

export const recommendationDTO = (r: Recommendation) => ({
  id: r.id,
  productId: r.productId,
  establishmentId: r.establishmentId,
  title: r.title,
  rationale: r.rationale,
  suggestedDiscount: r.suggestedDiscount,
  actions: r.actions as unknown as { type: string; label: string; primary?: boolean }[],
  learningNote: r.learningNote ?? undefined,
  confidence: r.confidence,
  riskScore: r.riskScore,
  appliedAction: r.appliedAction,
  appliedAt: r.appliedAt?.toISOString() ?? null,
});

export const notificationDTO = (n: Notification) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  data: n.data,
  read: n.readAt !== null,
  createdAt: n.createdAt.toISOString(),
});
