export type Role = 'supermercado' | 'restaurante' | 'cliente' | 'superadmin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  establishmentId?: string;
  avatarHue?: number;
}

export type EstablishmentType = 'supermercado' | 'restaurante';

export interface Establishment {
  id: string;
  name: string;
  type: EstablishmentType;
  address: string;
  city: string;
  logoHue: number;
  rating: number;
  /** Posición porcentual en el mapa simulado (0-100) */
  x: number;
  y: number;
  distanceKm: number;
  status: 'activo' | 'pendiente' | 'suspendido';
  joinedAt: string;
  schedule: string;
}

export type Category =
  | 'Lácteos'
  | 'Frutas y verduras'
  | 'Panadería'
  | 'Preparados'
  | 'Carnes'
  | 'Cajas de rescate'
  | 'Bebidas';

export type Unit = 'unidad' | 'kg' | 'g' | 'litro' | 'bandeja' | 'caja';

export type RiskLevel = 'bajo' | 'medio' | 'alto';

export type ProductStatus = 'en_inventario' | 'publicado' | 'agotado' | 'vencido' | 'donado';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: Category;
  emoji: string;
  image: string;
  quantity: number;
  unit: Unit;
  weightPerUnitKg: number;
  entryDate: string;
  expiryDate: string;
  originalPrice: number;
  discountPercent: number;
  establishmentId: string;
  status: ProductStatus;
  /** Ventas promedio por día, base para la rotación */
  dailySales: number;
  /** Tendencia de demanda de la última semana (-1 a 1) */
  demandTrend: number;
  featured?: boolean;
  isRescueBox?: boolean;
  createdBy?: 'seed' | 'user';
}

export interface ComputedRisk {
  score: number;
  level: RiskLevel;
  daysLeft: number;
  factors: RiskFactor[];
  wasteProbability: number;
  coverageDays: number;
}

export interface RiskFactor {
  label: string;
  detail: string;
  weight: number;
}

export type ActionType =
  | 'descuento'
  | 'combo'
  | 'publicar'
  | 'caja_rescate'
  | 'destacar'
  | 'donar'
  | 'venta_presencial';

export interface Recommendation {
  id: string;
  productId: string;
  title: string;
  rationale: string;
  suggestedDiscount: number;
  actions: { type: ActionType; label: string; primary?: boolean }[];
  learningNote?: string;
  confidence: number;
}

export interface Alert {
  id: string;
  productId: string;
  establishmentId: string;
  level: RiskLevel;
  title: string;
  body: string;
  createdAt: string;
  dismissedUntil?: string;
  resolved?: boolean;
}

export interface CartLine {
  productId: string;
  qty: number;
}

export type OrderMode = 'compra' | 'reserva';
export type PaymentMethod = 'tarjeta' | 'pse' | 'establecimiento';

export interface OrderItem {
  productId: string;
  name: string;
  emoji: string;
  image: string;
  qty: number;
  unitOriginalPrice: number;
  unitPrice: number;
  establishmentId: string;
  weightKg: number;
}

export interface Order {
  id: string;
  code: string;
  userId: string;
  userName: string;
  createdAt: string;
  mode: OrderMode;
  payment: PaymentMethod;
  items: OrderItem[];
  total: number;
  savings: number;
  wasteAvoidedKg: number;
  establishmentIds: string[];
  status: 'confirmado' | 'reservado' | 'entregado';
  pickupWindow: string;
}

export interface Sale {
  id: string;
  date: string;
  productId: string;
  productName: string;
  emoji: string;
  customer: string;
  establishmentId: string;
  qty: number;
  originalPrice: number;
  soldPrice: number;
  discountPercent: number;
  recovered: number;
  wasteAvoidedKg: number;
  channel: 'marketplace' | 'tienda';
}

/** Memoria de aprendizaje: resultados de promociones pasadas por categoría */
export interface PromoOutcome {
  id: string;
  category: Category;
  discountPercent: number;
  sellThrough: number;
  daysToSell: number;
  establishmentId: string;
  date: string;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone?: 'success' | 'info' | 'warn';
}
