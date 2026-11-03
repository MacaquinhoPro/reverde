/**
 * Trabajos periódicos del proceso de la API.
 *
 * Se ejecutan dentro del servidor porque son cortos y tolerantes a repetirse.
 * Si en el futuro hay varias réplicas conviene moverlos a un cron externo
 * (o a Vercel Cron) para no duplicar el trabajo; ninguno rompe si corre dos
 * veces, pero sí gasta de más.
 */
import { prisma } from './lib/prisma.ts';
import { logger } from './lib/logger.ts';
import { expireProducts, syncIntelligence } from './modules/inventory/service.ts';
import { expireStaleOrders } from './modules/orders/service.ts';

const timers: NodeJS.Timeout[] = [];

const every = (ms: number, name: string, job: () => Promise<unknown>) => {
  const run = () => {
    job().catch((err) => logger.error({ err, job: name }, 'trabajo programado falló'));
  };
  const timer = setInterval(run, ms);
  timer.unref();
  timers.push(timer);
};

export function startScheduler(): void {
  // Libera el inventario de las órdenes que nunca se pagaron.
  every(60_000, 'expire-orders', expireStaleOrders);

  // Marca productos vencidos y recalcula alertas y recomendaciones.
  every(15 * 60_000, 'refresh-intelligence', async () => {
    await expireProducts();
    const establishments = await prisma.establishment.findMany({
      where: { status: 'activo' },
      select: { id: true },
    });
    for (const e of establishments) await syncIntelligence(e.id);
  });

  // Limpieza: sesiones vencidas, tokens usados y claves de idempotencia.
  every(60 * 60_000, 'cleanup', async () => {
    const now = new Date();
    const [sessions, tokens, keys] = await Promise.all([
      prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } }),
      prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } }),
      prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } }),
    ]);
    logger.debug({ sessions: sessions.count, tokens: tokens.count, keys: keys.count }, 'limpieza periódica');
  });

  logger.info('programador de trabajos iniciado');
}

export const stopScheduler = () => {
  timers.forEach(clearInterval);
  timers.length = 0;
};
