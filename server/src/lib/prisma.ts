import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.ts';
import { logger } from './logger.ts';

/** Un solo cliente por proceso (el watch de desarrollo recarga el módulo). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: env.isDev ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] : ['error'],
  });

if (env.isDev) {
  globalForPrisma.prisma = prisma;
  // @ts-expect-error -- los eventos tipados dependen del generador
  prisma.$on('warn', (e: { message: string }) => logger.warn({ prisma: e.message }, 'prisma warn'));
}

export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
