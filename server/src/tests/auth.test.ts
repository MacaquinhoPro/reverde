import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CONSENT, Client, STRONG_PASSWORD, createUser, login, prisma, resetDatabase } from './helpers.ts';
import { sentMails } from '../lib/mailer.ts';
import { sha256 } from '../lib/crypto.ts';
import { env } from '../config/env.ts';

beforeEach(async () => {
  await resetDatabase();
  sentMails.length = 0;
});

afterAll(() => prisma.$disconnect());

describe('registro de usuarios reales', () => {
  it('crea la cuenta, abre sesión y envía el correo de confirmación', async () => {
    const client = new Client();
    const res = await client.post('/api/auth/register', {
      name: 'Ana Prueba',
      email: 'Ana.Prueba@Example.COM',
      password: STRONG_PASSWORD,
      phone: '+57 300 1112233',
      consent: CONSENT,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('cliente');
    expect(res.body.data.user.emailVerified).toBe(false);
    // El correo se normaliza a minúsculas.
    expect(res.body.data.user.email).toBe('ana.prueba@example.com');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ana.prueba@example.com' } });
    // La contraseña nunca viaja ni se guarda en claro.
    expect(JSON.stringify(res.body)).not.toContain(STRONG_PASSWORD);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    // El teléfono queda cifrado, no hasheado.
    expect(stored.phoneEncrypted).toMatch(/^v1\./);

    expect(sentMails.at(-1)?.to).toBe('ana.prueba@example.com');
    const session = await client.get('/api/auth/session');
    expect(session.body.data.authenticated).toBe(true);
  });

  it('nunca otorga el rol de superadmin desde el registro público', async () => {
    const client = new Client();
    await client.post('/api/auth/register', {
      name: 'Intruso',
      email: 'intruso@example.com',
      password: STRONG_PASSWORD,
      // Campos inyectados a propósito: el esquema los ignora.
      role: 'superadmin',
      accountType: 'comprador',
      consent: CONSENT,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'intruso@example.com' } });
    expect(user.role).toBe('cliente');
  });

  it('una cuenta de establecimiento queda como solicitud pendiente, sin el rol', async () => {
    const client = new Client();
    const res = await client.post('/api/auth/register', {
      name: 'Dueña de local',
      email: 'local@example.com',
      password: STRONG_PASSWORD,
      accountType: 'establecimiento',
      establishment: { name: 'Mi Tienda', type: 'supermercado', address: 'Cra 1 #2-3', city: 'Bogotá' },
      consent: CONSENT,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.establishmentRequest.status).toBe('pendiente');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'local@example.com' } });
    expect(user.role).toBe('cliente');
    expect(await prisma.establishment.count()).toBe(0);
  });

  it('rechaza contraseñas débiles con un mensaje útil', async () => {
    for (const password of ['corta', 'todominusculas1', 'SINNUMEROSAQUI', '1234567890']) {
      const res = await new Client().post('/api/auth/register', {
        name: 'Test',
        email: `t${Math.random()}@example.com`,
        password,
        consent: CONSENT,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    }
  });

  /**
   * Ley 1581 de 2012, art. 9: la autorización debe ser previa, expresa e
   * informada. Si el registro pudiera completarse sin ella, el tratamiento
   * sería ilícito desde el primer dato guardado.
   */
  it('no crea la cuenta sin autorización de tratamiento de datos', async () => {
    const sinConsentimiento = await new Client().post('/api/auth/register', {
      name: 'Sin permiso',
      email: 'sin.permiso@example.com',
      password: STRONG_PASSWORD,
    });
    expect(sinConsentimiento.status).toBe(400);
    expect(await prisma.user.count({ where: { email: 'sin.permiso@example.com' } })).toBe(0);

    // Un `false` explícito tampoco sirve: hace falta un acto afirmativo.
    const rechazando = await new Client().post('/api/auth/register', {
      name: 'Rechaza',
      email: 'rechaza@example.com',
      password: STRONG_PASSWORD,
      consent: { accepted: false, version: '1.0', marketing: false },
    });
    expect(rechazando.status).toBe(400);

    // Ni autorizar sin decir qué versión del texto se aceptó: sin eso no se
    // podría demostrar QUÉ autorizó la persona.
    const sinVersion = await new Client().post('/api/auth/register', {
      name: 'Sin version',
      email: 'sin.version@example.com',
      password: STRONG_PASSWORD,
      consent: { accepted: true, marketing: false },
    });
    expect(sinVersion.status).toBe(400);
  });

  it('guarda la evidencia del consentimiento con la hora del servidor', async () => {
    const antes = new Date();
    await new Client().post('/api/auth/register', {
      name: 'Autoriza',
      email: 'autoriza@example.com',
      password: STRONG_PASSWORD,
      // El cliente manda una fecha absurda: el servidor la ignora.
      consent: { ...CONSENT, version: '1.0', marketing: true, acceptedAt: '1999-01-01T00:00:00.000Z' },
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'autoriza@example.com' } });
    expect(user.consentVersion).toBe('1.0');
    expect(user.consentMarketing).toBe(true);
    expect(user.consentAcceptedAt).not.toBeNull();
    // La fecha la pone el servidor, no el cliente.
    expect(user.consentAcceptedAt!.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);
  });

  it('la finalidad de comunicaciones comerciales es opcional y por defecto no se autoriza', async () => {
    await new Client().post('/api/auth/register', {
      name: 'Solo lo necesario',
      email: 'minimo@example.com',
      password: STRONG_PASSWORD,
      consent: { accepted: true, version: '1.0' },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'minimo@example.com' } });
    expect(user.consentMarketing).toBe(false);
  });

  it('no permite dos cuentas con el mismo correo', async () => {
    await createUser({ email: 'repetido@example.com' });
    const res = await new Client().post('/api/auth/register', {
      name: 'Otra',
      email: 'repetido@example.com',
      password: STRONG_PASSWORD,
      consent: CONSENT,
    });
    expect(res.status).toBe(409);
  });
});

describe('inicio y cierre de sesión', () => {
  it('entrega cookie de sesión HttpOnly y cookie de CSRF legible', async () => {
    await createUser({ email: 'laura@test.co' });
    const client = new Client();
    const res = await client.post('/api/auth/login', { email: 'laura@test.co', password: STRONG_PASSWORD });

    expect(res.status).toBe(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(' ');
    expect(cookies).toContain(`${env.SESSION_COOKIE_NAME}=`);
    expect(cookies).toMatch(new RegExp(`${env.SESSION_COOKIE_NAME}=[^;]+;[^]*HttpOnly`, 'i'));
    // La de CSRF sí debe ser legible por el frontend.
    const csrfCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(env.CSRF_COOKIE_NAME));
    expect(csrfCookie?.toLowerCase()).not.toContain('httponly');
  });

  it('en la base de datos solo queda el hash del token de sesión', async () => {
    const user = await createUser({ email: 'hash@test.co' });
    const client = await login('hash@test.co');
    const sessionCookie = client.rawCookies.find((c) => c.startsWith(env.SESSION_COOKIE_NAME))!;
    const token = sessionCookie.split('=')[1];

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).toBe(sha256(token));
    expect(session.tokenHash).not.toBe(token);
    // La IP se guarda anonimizada.
    expect(session.ipHash).not.toContain('127.0.0.1');
  });

  it('rechaza la contraseña incorrecta con un mensaje que no revela nada', async () => {
    await createUser({ email: 'existe@test.co' });
    const noExiste = await new Client().post('/api/auth/login', { email: 'nadie@test.co', password: 'Reverde2026' });
    const malaClave = await new Client().post('/api/auth/login', { email: 'existe@test.co', password: 'OtraClave99' });

    expect(noExiste.status).toBe(401);
    expect(malaClave.status).toBe(401);
    // Mismo mensaje: no se pueden enumerar correos registrados.
    expect(noExiste.body.error.message).toBe(malaClave.body.error.message);
  });

  it('cerrar sesión revoca la sesión en la base de datos', async () => {
    const user = await createUser({ email: 'salir@test.co' });
    const client = await login('salir@test.co');
    await client.post('/api/auth/logout');

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.revokedAt).not.toBeNull();
    const after = await client.get('/api/auth/session');
    expect(after.body.data.authenticated).toBe(false);
  });

  it('una sesión revocada ya no sirve aunque se reutilice la cookie', async () => {
    const user = await createUser({ email: 'revocada@test.co' });
    const client = await login('revocada@test.co');
    await prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    const res = await client.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('una sesión vencida no autentica', async () => {
    const user = await createUser({ email: 'vencida@test.co' });
    const client = await login('vencida@test.co');
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('lista y revoca sesiones individuales', async () => {
    await createUser({ email: 'multi@test.co' });
    const a = await login('multi@test.co');
    const b = await login('multi@test.co');

    const list = await a.get('/api/auth/sessions');
    expect(list.body.data).toHaveLength(2);

    const other = list.body.data.find((s: { current: boolean }) => !s.current);
    expect((await a.del(`/api/auth/sessions/${other.id}`)).status).toBe(200);
    expect((await b.get('/api/auth/me')).status).toBe(401);
    expect((await a.get('/api/auth/me')).status).toBe(200);
  });
});

describe('protección contra fuerza bruta', () => {
  it('bloquea la cuenta tras varios intentos fallidos y no la desbloquea con la clave correcta', async () => {
    await createUser({ email: 'ataque@test.co' });
    for (let i = 0; i < env.MAX_LOGIN_ATTEMPTS; i++) {
      const res = await new Client().post('/api/auth/login', { email: 'ataque@test.co', password: `mala${i}` });
      expect(res.status).toBe(401);
    }
    const blocked = await new Client().post('/api/auth/login', { email: 'ataque@test.co', password: STRONG_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');

    // Los intentos quedan registrados para auditoría, con la IP anonimizada.
    const attempts = await prisma.loginAttempt.findMany({ where: { email: 'ataque@test.co' } });
    expect(attempts.length).toBeGreaterThanOrEqual(env.MAX_LOGIN_ATTEMPTS);
    expect(attempts.every((a) => !a.ipHash.includes('127.0.0.1'))).toBe(true);
  });

  it('una cuenta suspendida no puede entrar', async () => {
    const user = await createUser({ email: 'suspendida@test.co' });
    await prisma.user.update({ where: { id: user.id }, data: { status: 'suspendido' } });
    const res = await new Client().post('/api/auth/login', { email: 'suspendida@test.co', password: STRONG_PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('verificación de correo', () => {
  it('confirma el correo con el token del enlace y lo invalida después', async () => {
    const client = new Client();
    await client.post('/api/auth/register', { name: 'Ver', email: 'ver@test.co', password: STRONG_PASSWORD, consent: CONSENT });
    const link = sentMails.at(-1)!.text.match(/token=([\w-]+)/)!;
    const token = link[1];

    const res = await client.post('/api/auth/verify-email', { token });
    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);

    // Un token es de un solo uso.
    expect((await client.post('/api/auth/verify-email', { token })).status).toBe(400);
  });

  it('rechaza un token vencido', async () => {
    const client = new Client();
    await client.post('/api/auth/register', { name: 'Exp', email: 'exp@test.co', password: STRONG_PASSWORD, consent: CONSENT });
    const token = sentMails.at(-1)!.text.match(/token=([\w-]+)/)![1];
    await prisma.verificationToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await client.post('/api/auth/verify-email', { token })).status).toBe(400);
  });
});

describe('recuperación de contraseña', () => {
  it('responde igual exista o no la cuenta, y solo envía correo si existe', async () => {
    await createUser({ email: 'olvide@test.co' });
    const existe = await new Client().post('/api/auth/password/forgot', { email: 'olvide@test.co' });
    const mailsTrasExistente = sentMails.length;
    const noExiste = await new Client().post('/api/auth/password/forgot', { email: 'fantasma@test.co' });

    expect(existe.status).toBe(200);
    expect(noExiste.status).toBe(200);
    expect(noExiste.body.data.message).toBe(existe.body.data.message);
    // No se envió correo a una dirección que no está registrada.
    expect(sentMails.length).toBe(mailsTrasExistente);
  });

  it('restablece la contraseña, cierra todas las sesiones y el token no se reusa', async () => {
    const user = await createUser({ email: 'reset@test.co' });
    const sesionVieja = await login('reset@test.co');
    await new Client().post('/api/auth/password/forgot', { email: 'reset@test.co' });
    const token = sentMails.at(-1)!.text.match(/token=([\w-]+)/)![1];

    const res = await new Client().post('/api/auth/password/reset', { token, password: 'NuevaClave2026' });
    expect(res.status).toBe(200);

    // La sesión anterior quedó invalidada.
    expect((await sesionVieja.get('/api/auth/me')).status).toBe(401);
    // La clave vieja ya no sirve y la nueva sí.
    expect((await new Client().post('/api/auth/login', { email: 'reset@test.co', password: STRONG_PASSWORD })).status).toBe(401);
    expect((await new Client().post('/api/auth/login', { email: 'reset@test.co', password: 'NuevaClave2026' })).status).toBe(200);
    // Reusar el token falla.
    expect((await new Client().post('/api/auth/password/reset', { token, password: 'Otra2026Clave' })).status).toBe(400);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.failedLogins).toBe(0);
  });

  it('cambiar la contraseña autenticado exige la actual y conserva la sesión', async () => {
    await createUser({ email: 'cambio@test.co' });
    const client = await login('cambio@test.co');

    const mala = await client.post('/api/auth/password/change', {
      currentPassword: 'equivocada',
      newPassword: 'NuevaClave2026',
    });
    expect(mala.status).toBe(400);

    const igual = await client.post('/api/auth/password/change', {
      currentPassword: STRONG_PASSWORD,
      newPassword: STRONG_PASSWORD,
    });
    expect(igual.status).toBe(400);

    const ok = await client.post('/api/auth/password/change', {
      currentPassword: STRONG_PASSWORD,
      newPassword: 'NuevaClave2026',
    });
    expect(ok.status).toBe(200);
    // La sesión que hizo el cambio sigue viva.
    expect((await client.get('/api/auth/me')).status).toBe(200);
  });
});

describe('perfil', () => {
  it('actualiza nombre y teléfono, y devuelve el teléfono enmascarado', async () => {
    await createUser({ email: 'perfil@test.co' });
    const client = await login('perfil@test.co');

    const res = await client.patch('/api/auth/me', { name: 'Nombre Nuevo', phone: '+57 310 9998877' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Nombre Nuevo');

    const me = await client.get('/api/auth/me');
    expect(me.body.data.phoneMasked).toMatch(/•+8877$/);
    // El número completo no sale en la respuesta.
    expect(JSON.stringify(me.body)).not.toContain('310 9998877');
  });
});

describe('protección CSRF', () => {
  it('rechaza una petición autenticada sin el encabezado x-csrf-token', async () => {
    await createUser({ email: 'csrf@test.co' });
    const client = await login('csrf@test.co');
    const sinToken = client.withoutCsrf();

    const res = await sinToken.patch('/api/auth/me', { name: 'Cambiado por un tercero' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('CSRF');
  });
});

describe('alta del primer superadministrador', () => {
  it('exige el token de alta y solo funciona si no hay ninguno', async () => {
    const payload = {
      token: env.SUPERADMIN_BOOTSTRAP_TOKEN!,
      name: 'Equipo Reverde',
      email: 'root@reverde.com',
      password: 'SuperClave2026',
    };

    const malToken = await new Client().post('/api/auth/bootstrap-superadmin', { ...payload, token: 'token-equivocado' });
    expect(malToken.status).toBe(403);

    const creado = await new Client().post('/api/auth/bootstrap-superadmin', payload);
    expect(creado.status).toBe(201);
    expect(creado.body.data.user.role).toBe('superadmin');

    // Ya existe uno: el endpoint queda cerrado.
    const segundo = await new Client().post('/api/auth/bootstrap-superadmin', { ...payload, email: 'otro@reverde.com' });
    expect(segundo.status).toBe(403);
  });
});
