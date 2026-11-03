/**
 * Configuración de las pruebas en un solo lugar: la usa `vitest.config.ts`
 * para los procesos de prueba y `globalSetup.ts` para los subprocesos de
 * Prisma. Nunca apunta a la base de datos de desarrollo.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://reverde:reverde@localhost:5434/reverde_test?schema=public';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  TEST_DATABASE_URL,
  APP_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:4000',
  CORS_ORIGINS: 'http://localhost:5173',
  // Llave de 32 bytes exclusiva de las pruebas.
  ENCRYPTION_KEY: 'dGVzdC1vbmx5LWtleS0zMi1ieXRlcy1sb25nLWFhYWE=',
  IP_HASH_SALT: 'test-salt',
  ENABLE_DEMO_ACCOUNTS: 'true',
  DEMO_PASSWORD: 'Demo1234',
  SUPERADMIN_BOOTSTRAP_TOKEN: 'test-bootstrap-token',
  MAIL_TRANSPORT: 'log',
  PAYMENTS_PROVIDER: 'mock',
  PAYMENTS_CURRENCY: 'COP',
  PAYMENT_EXPIRY_MINUTES: '30',
  PAYMENTS_LIVE_ENABLED: 'false',
  LOG_LEVEL: 'silent',
  LOG_PRETTY: 'false',
  MAX_LOGIN_ATTEMPTS: '5',
  LOGIN_LOCK_MINUTES: '15',
  // El límite global de peticiones se desactiva: lo prueba su propio caso.
  RATE_LIMIT_MAX: '100000',
};
