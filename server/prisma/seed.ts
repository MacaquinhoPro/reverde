/**
 * Semillas de la base de datos.
 *
 * Dos partes bien separadas:
 *  1. **Catálogo de roles y permisos** → se siembra en TODOS los ambientes,
 *     producción incluida: es configuración, no datos de prueba.
 *  2. **Datos de demostración** (establecimientos, inventario, 60 días de
 *     ventas, cuentas demo) → solo si el ambiente los habilita. En producción
 *     el seed se niega a escribirlos.
 *
 *   npm run db:seed            → permisos + demo (según ENABLE_DEMO_ACCOUNTS)
 *   SEED_DEMO=false npm run db:seed → solo permisos y catálogos
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.ts';
import { hashPassword } from '../src/lib/password.ts';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/middleware/rbac.ts';
import { syncIntelligence } from '../src/modules/inventory/service.ts';
import { finalPrice } from '../src/domain/risk.ts';
import {
  CATALOG,
  CUSTOMER_NAMES,
  DEMO_USERS,
  ESTABLISHMENT_SEEDS,
  INVENTORY_ROWS,
  PROMO_SEEDS,
} from './catalog.ts';

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const ROLE_META = {
  cliente: { name: 'Comprador', description: 'Explora el marketplace, compra y reserva productos rescatados.' },
  supermercado: { name: 'Administrador de supermercado', description: 'Gestiona inventario, alertas, publicaciones y métricas de su supermercado.' },
  restaurante: { name: 'Administrador de restaurante', description: 'Gestiona inventario, alertas, publicaciones y métricas de su restaurante.' },
  superadmin: { name: 'Superadministrador', description: 'Administra usuarios, establecimientos y la operación de la plataforma.' },
} as const;

const addDays = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
};

/** RNG determinista: el histórico de demostración siempre da las mismas cifras. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────── 1 · Roles y permisos (todos los ambientes) ─────────────── */

async function seedRbac() {
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, create: { code, description }, update: { description } });
  }
  for (const [code, meta] of Object.entries(ROLE_META)) {
    await prisma.role.upsert({
      where: { code: code as keyof typeof ROLE_META },
      create: { code: code as keyof typeof ROLE_META, ...meta },
      update: meta,
    });
  }
  for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    // Se reescribe la matriz del rol: el código es la fuente de verdad.
    await prisma.rolePermission.deleteMany({ where: { roleCode: roleCode as keyof typeof ROLE_META } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permissionCode) => ({ roleCode: roleCode as keyof typeof ROLE_META, permissionCode })),
      skipDuplicates: true,
    });
  }
  console.log(`✓ ${Object.keys(PERMISSIONS).length} permisos y ${Object.keys(ROLE_META).length} roles sincronizados`);
}

/* ────────────────── 2 · Datos de demostración (dev/test) ────────────────── */

async function seedDemo() {
  const password = env.DEMO_PASSWORD || 'Demo1234';
  const passwordHash = await hashPassword(password);

  // ── Establecimientos ────────────────────────────────────────────────────
  const establishments = new Map<string, string>();
  for (const seed of ESTABLISHMENT_SEEDS) {
    const est = await prisma.establishment.upsert({
      where: { slug: seed.slug },
      create: { ...seed, joinedAt: new Date(seed.joinedAt) },
      update: { ...seed, joinedAt: new Date(seed.joinedAt) },
    });
    establishments.set(seed.slug, est.id);
  }
  console.log(`✓ ${establishments.size} establecimientos`);

  // ── Cuentas de demostración ─────────────────────────────────────────────
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        name: demo.name,
        role: demo.role,
        passwordHash,
        status: 'activo',
        // Las cuentas demo ya vienen confirmadas para poder probar sin correo.
        emailVerifiedAt: new Date(),
        avatarHue: demo.avatarHue,
        isDemo: true,
      },
      update: { passwordHash, role: demo.role, isDemo: true, status: 'activo', emailVerifiedAt: new Date() },
    });
    if (demo.slug) {
      const establishmentId = establishments.get(demo.slug)!;
      await prisma.establishmentUser.upsert({
        where: { establishmentId_userId: { establishmentId, userId: user.id } },
        create: { establishmentId, userId: user.id, role: 'owner' },
        update: { role: 'owner' },
      });
    }
  }
  console.log(`✓ ${DEMO_USERS.length} cuentas de demostración (contraseña: ${password})`);

  // ── Inventario ──────────────────────────────────────────────────────────
  // Se borra el inventario sembrado anterior para no duplicarlo al re-sembrar.
  await prisma.product.deleteMany({ where: { origin: 'seed' } });

  let created = 0;
  for (const [slug, key, qty, expiryIn, ageDays, dailySales, trend, discount, published] of INVENTORY_ROWS) {
    const establishmentId = establishments.get(slug);
    const item = CATALOG[key];
    if (!establishmentId || !item) continue;

    const product = await prisma.product.create({
      data: {
        establishmentId,
        name: item.name,
        description: item.description,
        category: item.category,
        emoji: item.emoji,
        image: item.image,
        photo: item.photo,
        unit: item.unit,
        weightPerUnitKg: item.weightPerUnitKg,
        entryDate: addDays(-ageDays),
        expiryDate: addDays(expiryIn),
        originalPrice: item.price,
        discountPercent: discount,
        dailySales,
        demandTrend: trend,
        status: published ? 'publicado' : 'en_inventario',
        featured: discount >= 40,
        isRescueBox: item.isRescueBox ?? false,
        origin: 'seed',
        inventory: { create: { quantity: qty } },
      },
      include: { inventory: true },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: product.inventory!.id,
        productId: product.id,
        establishmentId,
        type: 'ingreso',
        quantity: qty,
        reason: 'Carga inicial de inventario (semilla)',
      },
    });
    if (published) {
      await prisma.marketplaceListing.create({
        data: { productId: product.id, establishmentId, featured: product.featured },
      });
    }
    created += 1;
  }
  console.log(`✓ ${created} productos en inventario`);

  // ── Histórico de ventas (60 días) ───────────────────────────────────────
  await prisma.sale.deleteMany({ where: { isSeed: true } });
  const rnd = mulberry32(20260922);
  const keys = Object.keys(CATALOG);
  const sales: Parameters<typeof prisma.sale.createMany>[0]['data'] = [];

  for (let day = 59; day >= 0; day--) {
    // La adopción crece con el tiempo: ~+18 % de un mes al siguiente.
    const momentum = 1 + (59 - day) / 152;
    ESTABLISHMENT_SEEDS.forEach((est, ei) => {
      const exact = (0.95 + rnd() * 0.55) * momentum * (est.type === 'supermercado' ? 1.3 : 1);
      const perDay = Math.floor(exact) + (rnd() < exact % 1 ? 1 : 0);
      for (let k = 0; k < perDay; k++) {
        const item = CATALOG[keys[Math.floor(rnd() * keys.length)]];
        const discount = [20, 25, 30, 35, 40, 45][Math.floor(rnd() * 6)];
        const qty = 1 + Math.floor(rnd() * (item.isRescueBox ? 2 : 3));
        const soldPrice = finalPrice(item.price, discount);
        const date = addDays(-day);
        date.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
        sales.push({
          establishmentId: establishments.get(est.slug)!,
          productName: item.name,
          emoji: item.emoji,
          photo: item.photo,
          category: item.category,
          customerName: CUSTOMER_NAMES[(Math.floor(rnd() * CUSTOMER_NAMES.length) + ei) % CUSTOMER_NAMES.length],
          quantity: qty,
          originalPrice: item.price,
          soldPrice,
          discountPercent: discount,
          recovered: soldPrice * qty,
          wasteAvoidedKg: +(item.weightPerUnitKg * qty).toFixed(2),
          channel: rnd() > 0.22 ? 'marketplace' : 'tienda',
          occurredAt: date,
          isSeed: true,
        });
      }
    });
  }
  // createMany en lotes: son varios miles de filas.
  for (let i = 0; i < sales.length; i += 1000) {
    await prisma.sale.createMany({ data: sales.slice(i, i + 1000) });
  }
  console.log(`✓ ${sales.length} ventas históricas de 60 días`);

  // ── Memoria de aprendizaje de promociones ───────────────────────────────
  await prisma.promoOutcome.deleteMany({ where: { isSeed: true } });
  const promoRnd = mulberry32(777);
  await prisma.promoOutcome.createMany({
    data: PROMO_SEEDS.map((p) => ({
      establishmentId: establishments.get(p.slug)!,
      category: p.category,
      discountPercent: p.discountPercent,
      sellThrough: p.sellThrough,
      daysToSell: p.daysToSell,
      occurredAt: addDays(-Math.floor(5 + promoRnd() * 50)),
      isSeed: true,
    })),
  });
  console.log(`✓ ${PROMO_SEEDS.length} resultados de promociones anteriores`);

  // ── Alertas y recomendaciones derivadas del inventario ──────────────────
  for (const id of establishments.values()) await syncIntelligence(id);
  const [alerts, recs] = await Promise.all([prisma.expirationAlert.count(), prisma.recommendation.count()]);
  console.log(`✓ ${alerts} alertas y ${recs} recomendaciones calculadas`);
}

async function main() {
  console.log(`\n🌱 Sembrando Reverde · ambiente: ${env.NODE_ENV}\n`);
  await seedRbac();

  const wantsDemo = process.env.SEED_DEMO !== 'false';
  if (!wantsDemo) {
    console.log('↷ datos de demostración omitidos (SEED_DEMO=false)');
    return;
  }
  if (env.isProd) {
    // Barrera dura: producción no recibe datos de prueba.
    console.log('↷ datos de demostración omitidos: NODE_ENV=production');
    return;
  }
  if (!env.demoEnabled) {
    console.log('↷ datos de demostración omitidos: ENABLE_DEMO_ACCOUNTS=false');
    return;
  }
  await seedDemo();
  console.log('\n✅ Listo. Entra con cualquiera de las cuentas demo.\n');
}

main()
  .catch((error) => {
    console.error('\n❌ El seed falló:\n', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
