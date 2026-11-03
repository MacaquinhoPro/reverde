/** Punto de entrada del servidor. */
import { createApp } from './app.ts';
import { assertProductionSafety, env } from './config/env.ts';
import { logger } from './lib/logger.ts';
import { prisma } from './lib/prisma.ts';
import { startScheduler, stopScheduler } from './scheduler.ts';

// Si la configuración de producción es insegura, el proceso no arranca.
assertProductionSafety();

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      puerto: env.PORT,
      ambiente: env.NODE_ENV,
      pasarela: env.PAYMENTS_PROVIDER,
      cobrosReales: env.PAYMENTS_LIVE_ENABLED,
      demo: env.demoEnabled,
    },
    `API de Reverde escuchando en ${env.API_URL}`,
  );
  logger.info(`Documentación: ${env.API_URL}/api/docs`);
});

startScheduler();

/** Cierre ordenado: deja de aceptar conexiones y suelta la base de datos. */
const shutdown = (signal: string) => {
  logger.info({ signal }, 'cerrando la API');
  stopScheduler();
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'promesa rechazada sin manejar'));
