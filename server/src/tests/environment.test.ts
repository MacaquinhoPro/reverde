/**
 * Separación entre desarrollo y producción. Estas pruebas verifican que la
 * configuración insegura no arranque, que las cuentas demo no existan en
 * producción y que los endpoints de desarrollo no se expongan.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { CONSENT, app, createUser, prisma, resetDatabase, Client } from './helpers.ts';
import { assertProductionSafety, env, type Env } from '../config/env.ts';

const prod = (overrides: Partial<Env> = {}): Env => ({
  ...env,
  NODE_ENV: 'production',
  isProd: true,
  isDev: false,
  isTest: false,
  demoEnabled: false,
  ENABLE_DEMO_ACCOUNTS: false,
  COOKIE_SECURE: true,
  APP_URL: 'https://reverde.app',
  API_URL: 'https://api.reverde.app',
  CORS_ORIGINS: ['https://reverde.app'],
  ENCRYPTION_KEY: 'bGxhdmUtcmVhbC1kZS0zMi1ieXRlcy1wcm9kdWNjaW9uQA==',
  IP_HASH_SALT: 'c2FsLWFsZWF0b3JpYS1kZS1wcm9kdWNjaW9uLTMyLWI=',
  MAIL_TRANSPORT: 'smtp',
  PAYMENTS_PROVIDER: 'wompi',
  WOMPI_PUBLIC_KEY: 'pub_test_abc',
  WOMPI_PRIVATE_KEY: 'prv_test_abc',
  WOMPI_INTEGRITY_SECRET: 'integridad',
  WOMPI_EVENTS_SECRET: 'eventos',
  PAYMENTS_LIVE_ENABLED: false,
  ...overrides,
});

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('barreras de arranque en producción', () => {
  it('una configuración de producción completa pasa', () => {
    expect(() => assertProductionSafety(prod())).not.toThrow();
  });

  it('no arranca con cuentas de demostración habilitadas', () => {
    expect(() => assertProductionSafety(prod({ ENABLE_DEMO_ACCOUNTS: true }))).toThrow(/ENABLE_DEMO_ACCOUNTS/);
  });

  it('exige HTTPS y cookies seguras', () => {
    expect(() => assertProductionSafety(prod({ COOKIE_SECURE: false }))).toThrow(/COOKIE_SECURE/);
    expect(() => assertProductionSafety(prod({ APP_URL: 'http://reverde.app' }))).toThrow(/APP_URL/);
    expect(() => assertProductionSafety(prod({ API_URL: 'http://api.reverde.app' }))).toThrow(/API_URL/);
  });

  it('no admite CORS vacío ni con comodín', () => {
    expect(() => assertProductionSafety(prod({ CORS_ORIGINS: [] }))).toThrow(/CORS_ORIGINS/);
    expect(() => assertProductionSafety(prod({ CORS_ORIGINS: ['*'] }))).toThrow(/comodín/);
  });

  it('no admite la llave de cifrado de desarrollo', () => {
    expect(() =>
      assertProductionSafety(prod({ ENCRYPTION_KEY: 'ZGV2LW9ubHkta2V5LWRvLW5vdC11c2UtaW4tcHJvZCE=' })),
    ).toThrow(/ENCRYPTION_KEY/);
  });

  it('no admite la sal de IP de desarrollo', () => {
    expect(() => assertProductionSafety(prod({ IP_HASH_SALT: 'dev-ip-salt' }))).toThrow(/IP_HASH_SALT/);
  });

  it('no admite el simulador de pagos ni el correo de consola', () => {
    expect(() => assertProductionSafety(prod({ PAYMENTS_PROVIDER: 'mock' }))).toThrow(/mock/);
    expect(() => assertProductionSafety(prod({ MAIL_TRANSPORT: 'log' }))).toThrow(/MAIL_TRANSPORT/);
  });

  it('exige todas las llaves de la pasarela', () => {
    expect(() => assertProductionSafety(prod({ WOMPI_EVENTS_SECRET: undefined }))).toThrow(/WOMPI_EVENTS_SECRET/);
    expect(() => assertProductionSafety(prod({ WOMPI_INTEGRITY_SECRET: undefined }))).toThrow(/WOMPI_INTEGRITY_SECRET/);
  });

  it('con llaves de producción exige la autorización explícita de cobros reales', () => {
    // Llaves reales pero sin el interruptor: no arranca.
    expect(() =>
      assertProductionSafety(prod({ WOMPI_PUBLIC_KEY: 'pub_prod_abc', PAYMENTS_LIVE_ENABLED: false })),
    ).toThrow(/autorización explícita/);

    // Llaves reales con el interruptor: sí arranca.
    expect(() =>
      assertProductionSafety(prod({ WOMPI_PUBLIC_KEY: 'pub_prod_abc', PAYMENTS_LIVE_ENABLED: true })),
    ).not.toThrow();

    // Interruptor encendido con llaves de prueba: inconsistente.
    expect(() => assertProductionSafety(prod({ PAYMENTS_LIVE_ENABLED: true }))).toThrow(/inconsistente/);
  });

  it('en desarrollo no aplica ninguna de estas barreras', () => {
    expect(() => assertProductionSafety(env)).not.toThrow();
  });
});

describe('cuentas de demostración', () => {
  it('una cuenta demo no entra si el ambiente las deshabilita', async () => {
    await createUser({ email: 'demo@reverde.com', isDemo: true, password: 'Demo1234' });

    // En este ambiente de pruebas están habilitadas: entra.
    const ok = await new Client().post('/api/auth/login', { email: 'demo@reverde.com', password: 'Demo1234' });
    expect(ok.status).toBe(200);

    // El servicio de autenticación bloquea las demo cuando no están habilitadas.
    const { authenticate } = await import('../modules/auth/service.ts');
    const envModule = await import('../config/env.ts');
    const original = envModule.env.demoEnabled;
    try {
      Object.defineProperty(envModule.env, 'demoEnabled', { value: false, configurable: true });
      await expect(authenticate('demo@reverde.com', 'Demo1234')).rejects.toThrow(/demostración/);
    } finally {
      Object.defineProperty(envModule.env, 'demoEnabled', { value: original, configurable: true });
    }
  });

  it('el seed no escribe datos de demostración en producción', async () => {
    // La barrera vive en prisma/seed.ts: NODE_ENV=production omite seedDemo().
    const seed = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../prisma/seed.ts', import.meta.url), 'utf8'),
    );
    expect(seed).toContain("if (env.isProd)");
    expect(seed).toContain('datos de demostración omitidos: NODE_ENV=production');
  });
});

describe('endpoints de desarrollo', () => {
  it('existen fuera de producción', async () => {
    const res = await request(app).get('/api/dev/demo-accounts');
    expect(res.status).toBe(200);
  });

  it('el router de desarrollo solo se monta si NODE_ENV no es production', async () => {
    const appSource = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../app.ts', import.meta.url), 'utf8'),
    );
    expect(appSource).toContain("if (!env.isProd) app.use('/api/dev', devRouter);");
  });
});

describe('higiene de la API', () => {
  it('el estado de salud reporta la base de datos y el ambiente', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('ok');
    expect(res.body.data.env).toBe('test');
  });

  it('no filtra la tecnología del servidor ni cabeceras de más', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    // Helmet puesto: cabeceras de seguridad básicas.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('una ruta inexistente responde 404 con forma de error de la API', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('un JSON malformado responde 400, no 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });

  it('bloquea orígenes que no están en la lista blanca', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://sitio-malicioso.example');
    // CORS no devuelve la cabecera que autoriza al origen.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('publica la documentación OpenAPI', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(40);
  });

  it('el límite de peticiones responde 429 cuando se supera', async () => {
    const { rateLimit, resetRateLimits } = await import('../middleware/rateLimit.ts');
    resetRateLimits();
    const limiter = rateLimit({ max: 2, windowSeconds: 60, keyPrefix: 'prueba' });
    const calls: number[] = [];
    const fakeReq = { headers: {}, ip: '1.2.3.4' } as never;
    const fakeRes = { setHeader: () => {} } as never;
    for (let i = 0; i < 4; i++) {
      await new Promise<void>((resolve) => {
        limiter(fakeReq, fakeRes, ((err?: unknown) => {
          calls.push(err ? 429 : 200);
          resolve();
        }) as never);
      });
    }
    expect(calls).toEqual([200, 200, 429, 429]);
    resetRateLimits();
  });
});

describe('auditoría', () => {
  it('registra las acciones sensibles sin guardar datos sensibles', async () => {
    const client = new Client();
    await client.post('/api/auth/register', {
      name: 'Auditada',
      email: 'auditada@test.co',
      password: 'Reverde2026',
      phone: '+57 300 1234567',
      consent: CONSENT,
    });

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.register' } });
    expect(log.actorUserId).toBeTruthy();
    const serialized = JSON.stringify(log);
    // Ni la contraseña ni el teléfono ni la IP en claro.
    expect(serialized).not.toContain('Reverde2026');
    expect(serialized).not.toContain('300 1234567');
    expect(serialized).not.toContain('127.0.0.1');
    expect(log.ipHash).toBeTruthy();
  });
});
