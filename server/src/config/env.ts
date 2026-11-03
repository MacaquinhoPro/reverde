/**
 * Carga y validación de la configuración. Una sola fuente de verdad: si una
 * variable obligatoria falta o es insegura para el ambiente, el proceso no
 * arranca (mejor caerse al inicio que operar mal configurado).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const ROOT = resolve(import.meta.dirname ?? process.cwd(), '../../..');
const NODE_ENV = process.env.NODE_ENV ?? 'development';

/** Orden de carga: lo específico del ambiente gana sobre lo general. */
for (const file of [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env.local', '.env']) {
  const path = resolve(ROOT, file);
  if (existsSync(path)) dotenv.config({ path, override: false, quiet: true });
}

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const int = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int().positive());

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: csv,

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  TEST_DATABASE_URL: z.string().optional(),

  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY es obligatoria'),
  IP_HASH_SALT: z.string().min(1, 'IP_HASH_SALT es obligatoria'),
  SESSION_TTL_HOURS: int(72),
  SESSION_COOKIE_NAME: z.string().default('rv_session'),
  CSRF_COOKIE_NAME: z.string().default('rv_csrf'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: bool(false),
  COOKIE_DOMAIN: z.string().optional(),

  MAX_LOGIN_ATTEMPTS: int(5),
  LOGIN_LOCK_MINUTES: int(15),
  RATE_LIMIT_WINDOW_SECONDS: int(60),
  RATE_LIMIT_MAX: int(300),
  ENABLE_DEMO_ACCOUNTS: bool(false),
  DEMO_PASSWORD: z.string().optional(),
  SUPERADMIN_BOOTSTRAP_TOKEN: z.string().optional(),

  MAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
  MAIL_FROM: z.string().default('Reverde <no-reply@reverde.app>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: int(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  PAYMENTS_PROVIDER: z.enum(['mock', 'wompi']).default('mock'),
  PAYMENTS_CURRENCY: z.string().default('COP'),
  PAYMENT_EXPIRY_MINUTES: int(30),
  PAYMENTS_LIVE_ENABLED: bool(false),
  WOMPI_PUBLIC_KEY: z.string().optional(),
  WOMPI_PRIVATE_KEY: z.string().optional(),
  WOMPI_INTEGRITY_SECRET: z.string().optional(),
  WOMPI_EVENTS_SECRET: z.string().optional(),
  WOMPI_CHECKOUT_URL: z.string().default('https://checkout.wompi.co/p/'),
  WOMPI_API_URL: z.string().default('https://sandbox.wompi.co/v1'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuración inválida:\n${detail}\n\nRevisa .env.example`);
}

const raw = parsed.data;

/** En pruebas se usa la base de datos de pruebas, nunca la de desarrollo. */
const databaseUrl =
  raw.NODE_ENV === 'test' && raw.TEST_DATABASE_URL ? raw.TEST_DATABASE_URL : raw.DATABASE_URL;

export const env = {
  ...raw,
  DATABASE_URL: databaseUrl,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  isDev: raw.NODE_ENV === 'development',
  /** Las cuentas y endpoints de demostración solo existen fuera de producción. */
  demoEnabled: raw.ENABLE_DEMO_ACCOUNTS && raw.NODE_ENV !== 'production',
};

export type Env = typeof env;

/**
 * Barreras de producción. Son errores de arranque a propósito: un despliegue
 * mal configurado no debe quedar sirviendo tráfico real.
 */
export function assertProductionSafety(e: Env = env): void {
  if (!e.isProd) return;
  const errors: string[] = [];

  if (e.ENABLE_DEMO_ACCOUNTS) errors.push('ENABLE_DEMO_ACCOUNTS debe ser false en producción.');
  if (!e.COOKIE_SECURE) errors.push('COOKIE_SECURE debe ser true en producción (HTTPS obligatorio).');
  if (!e.APP_URL.startsWith('https://')) errors.push('APP_URL debe usar HTTPS.');
  if (!e.API_URL.startsWith('https://')) errors.push('API_URL debe usar HTTPS.');
  if (e.CORS_ORIGINS.length === 0) errors.push('CORS_ORIGINS no puede quedar vacío en producción.');
  if (e.CORS_ORIGINS.some((o) => o === '*')) errors.push('CORS_ORIGINS no admite comodín en producción.');
  if (e.ENCRYPTION_KEY.includes('dev-only')) errors.push('ENCRYPTION_KEY sigue siendo la de desarrollo.');
  if (e.MAIL_TRANSPORT === 'log') errors.push('MAIL_TRANSPORT debe ser smtp en producción.');
  if (e.PAYMENTS_PROVIDER === 'mock') errors.push('PAYMENTS_PROVIDER no puede ser mock en producción.');
  if (e.PAYMENTS_PROVIDER === 'wompi') {
    for (const key of ['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET'] as const) {
      if (!e[key]) errors.push(`${key} es obligatoria con PAYMENTS_PROVIDER=wompi.`);
    }
    // El cobro real exige un interruptor explícito, no solo tener llaves.
    const live = e.WOMPI_PUBLIC_KEY?.startsWith('pub_prod_');
    if (live && !e.PAYMENTS_LIVE_ENABLED) {
      errors.push(
        'Hay llaves de producción de Wompi pero PAYMENTS_LIVE_ENABLED=false. ' +
          'Activar cobros reales requiere autorización explícita.',
      );
    }
    if (!live && e.PAYMENTS_LIVE_ENABLED) {
      errors.push('PAYMENTS_LIVE_ENABLED=true con llaves de sandbox: configuración inconsistente.');
    }
  }

  if (errors.length) throw new Error(`Configuración de producción insegura:\n${errors.map((m) => `  · ${m}`).join('\n')}`);
}
