/** Utilidades compartidas por las pruebas de integración. */
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.ts';
import { prisma } from '../lib/prisma.ts';
import { env } from '../config/env.ts';
import { hashPassword } from '../lib/password.ts';
import { resetRateLimits } from '../middleware/rateLimit.ts';
import { syncIntelligence } from '../modules/inventory/service.ts';

export const app: Express = createApp();

export const STRONG_PASSWORD = 'Reverde2026';

/**
 * Autorización de tratamiento de datos válida (Ley 1581 de 2012).
 * `POST /api/auth/register` la exige, así que toda prueba que cree una cuenta
 * por esa vía la envía. Que sea obligatoria es la razón de que exista esta
 * constante: si fuera opcional, una prueba podría crear cuentas sin evidencia
 * del consentimiento y nadie lo notaría.
 */
export const CONSENT = { accepted: true as const, version: '1.0', marketing: false };

/** Borra todos los datos dejando intacto el catálogo de roles y permisos. */
export async function resetDatabase(): Promise<void> {
  // El orden importa menos con TRUNCATE CASCADE, y es mucho más rápido.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "PaymentEvent", "Payment", "OrderItem", "Order", "CartItem", "Cart",
      "Sale", "PromoOutcome", "InventoryMovement", "ExpirationAlert",
      "Recommendation", "MarketplaceListing", "Inventory", "Product",
      "EstablishmentRequest", "EstablishmentUser", "Establishment",
      "Notification", "AuditLog", "IdempotencyRecord",
      "LoginAttempt", "VerificationToken", "Session", "User"
    RESTART IDENTITY CASCADE
  `);
  resetRateLimits();
}

/**
 * Cliente HTTP con cookies: guarda la de sesión y repite la de CSRF en el
 * encabezado, igual que hace el frontend.
 */
export class Client {
  private cookies: string[] = [];

  private csrf(): string | undefined {
    const raw = this.cookies.find((c) => c.startsWith(`${env.CSRF_COOKIE_NAME}=`));
    return raw?.split(';')[0]?.split('=')[1];
  }

  private absorb(res: request.Response) {
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return res;
    for (const cookie of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const name = cookie.split('=')[0];
      this.cookies = this.cookies.filter((c) => !c.startsWith(`${name}=`));
      // Una cookie borrada (expires en el pasado) no se conserva.
      if (!/Expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.push(cookie.split(';')[0]);
    }
    return res;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.cookies.length) headers.Cookie = this.cookies.join('; ');
    const token = this.csrf();
    if (token) headers['x-csrf-token'] = token;
    return headers;
  }

  async get(path: string) {
    return this.absorb(await request(app).get(path).set(this.headers()));
  }

  async post(path: string, body: unknown = {}, extra: Record<string, string> = {}) {
    return this.absorb(await request(app).post(path).set({ ...this.headers(), ...extra }).send(body as object));
  }

  async patch(path: string, body: unknown = {}) {
    return this.absorb(await request(app).patch(path).set(this.headers()).send(body as object));
  }

  async del(path: string) {
    return this.absorb(await request(app).delete(path).set(this.headers()));
  }

  /** Cliente sin cookie de CSRF, para probar que la protección actúa. */
  withoutCsrf() {
    const clone = new Client();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (clone as any).cookies = this.cookies.filter((c) => !c.startsWith(`${env.CSRF_COOKIE_NAME}=`));
    return clone;
  }

  get rawCookies() {
    return [...this.cookies];
  }
}

/* ─────────────────────────── Factorías ─────────────────────────── */

export async function createEstablishment(overrides: Partial<{ name: string; slug: string; type: 'supermercado' | 'restaurante'; status: 'activo' | 'pendiente' }> = {}) {
  const slug = overrides.slug ?? `est-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.establishment.create({
    data: {
      slug,
      name: overrides.name ?? `Establecimiento ${slug}`,
      type: overrides.type ?? 'supermercado',
      address: 'Cra. 15 #93-47',
      city: 'Bogotá',
      schedule: 'Lun a Dom · 8:00 – 20:00',
      status: overrides.status ?? 'activo',
    },
  });
}

export async function createUser(options: {
  email: string;
  role?: 'cliente' | 'supermercado' | 'restaurante' | 'superadmin';
  establishmentId?: string;
  password?: string;
  verified?: boolean;
  isDemo?: boolean;
  name?: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: options.email,
      name: options.name ?? 'Persona de prueba',
      role: options.role ?? 'cliente',
      passwordHash: await hashPassword(options.password ?? STRONG_PASSWORD),
      status: 'activo',
      emailVerifiedAt: options.verified === false ? null : new Date(),
      isDemo: options.isDemo ?? false,
    },
  });
  if (options.establishmentId) {
    await prisma.establishmentUser.create({
      data: { establishmentId: options.establishmentId, userId: user.id, role: 'owner' },
    });
  }
  return user;
}

export async function login(email: string, password = STRONG_PASSWORD): Promise<Client> {
  const client = new Client();
  const res = await client.post('/api/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`login falló (${res.status}): ${JSON.stringify(res.body)}`);
  return client;
}

export async function createProduct(options: {
  establishmentId: string;
  quantity?: number;
  price?: number;
  discountPercent?: number;
  expiresInDays?: number;
  published?: boolean;
  name?: string;
  category?: string;
  dailySales?: number;
}) {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (options.expiresInDays ?? 3));
  expiry.setHours(12, 0, 0, 0);
  const published = options.published ?? true;

  const product = await prisma.product.create({
    data: {
      establishmentId: options.establishmentId,
      name: options.name ?? 'Yogur natural',
      description: 'Producto de prueba',
      category: options.category ?? 'Lácteos',
      emoji: '🥛',
      image: 'from-[#F4F7FF] to-[#DCE6FA]',
      photo: '/img/productos/yogur.jpg',
      unit: 'unidad',
      weightPerUnitKg: 0.2,
      entryDate: new Date(Date.now() - 86_400_000),
      expiryDate: expiry,
      originalPrice: options.price ?? 10_000,
      discountPercent: options.discountPercent ?? 0,
      dailySales: options.dailySales ?? 2,
      demandTrend: 0,
      status: published ? 'publicado' : 'en_inventario',
      origin: 'user',
      inventory: { create: { quantity: options.quantity ?? 10 } },
      ...(published ? { listing: { create: { establishmentId: options.establishmentId } } } : {}),
    },
    include: { inventory: true },
  });
  return product;
}

/** Monta un escenario completo: establecimiento, administrador, comprador y producto. */
export async function scenario(options: { quantity?: number; price?: number; discountPercent?: number } = {}) {
  const establishment = await createEstablishment({ name: 'Supermercado Verde' });
  const admin = await createUser({
    email: 'admin.est@test.co',
    role: 'supermercado',
    establishmentId: establishment.id,
    name: 'Laura Mendoza',
  });
  const buyer = await createUser({ email: 'compra@test.co', role: 'cliente', name: 'Sofía Herrera' });
  const product = await createProduct({
    establishmentId: establishment.id,
    quantity: options.quantity ?? 10,
    price: options.price ?? 10_000,
    discountPercent: options.discountPercent ?? 20,
  });
  await syncIntelligence(establishment.id);
  return { establishment, admin, buyer, product };
}

/** Dispara el webhook del simulador tal como lo haría la pasarela. */
export async function payOrder(orderId: string, status: 'APPROVED' | 'DECLINED' = 'APPROVED', timestamp?: number) {
  const payment = await prisma.payment.findFirstOrThrow({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });
  const { buildMockEvent } = await import('../modules/payments/mock.ts');
  const { processProviderEvent } = await import('../modules/payments/service.ts');
  const { gateway } = await import('../modules/payments/index.ts');
  const event = buildMockEvent({
    transactionId: `tx-${payment.id.slice(0, 8)}`,
    reference: payment.reference,
    status,
    amountInCents: payment.amountInCents,
    timestamp,
  });
  const parsed = gateway().parseEvent(Buffer.from(JSON.stringify(event)), {});
  return { outcome: await processProviderEvent(parsed), payment, event };
}

export { prisma };
