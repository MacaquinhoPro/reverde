/** Reglas de autenticación: registro, verificación, contraseñas y bloqueos. */
import type { TokenPurpose, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.ts';
import { env } from '../../config/env.ts';
import { encrypt, hashIp, randomToken, sha256 } from '../../lib/crypto.ts';
import { hashPassword, verifyPassword } from '../../lib/password.ts';
import { badRequest, conflict, tooMany, unauthorized } from '../../lib/errors.ts';
import { resetEmail, sendMail, verificationEmail } from '../../lib/mailer.ts';

const VERIFY_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 3_600_000;

/** Genera un token de un solo uso y guarda únicamente su huella. */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomToken(32);
  const ttl = purpose === 'email_verification' ? VERIFY_TTL_MS : RESET_TTL_MS;
  // Un token nuevo invalida los anteriores del mismo propósito.
  await prisma.verificationToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.verificationToken.create({
    data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl) },
  });
  return token;
}

export async function consumeToken(token: string, purpose: TokenPurpose) {
  const row = await prisma.verificationToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= new Date()) {
    throw badRequest('El enlace no es válido o ya venció. Solicita uno nuevo.');
  }
  await prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.user;
}

export const verifyLink = (token: string) => `${env.APP_URL}/verificar-correo?token=${token}`;
export const resetLink = (token: string) => `${env.APP_URL}/restablecer?token=${token}`;

export async function sendVerification(user: Pick<User, 'id' | 'name' | 'email'>): Promise<void> {
  const token = await issueToken(user.id, 'email_verification');
  const mail = verificationEmail(user.name, verifyLink(token));
  await sendMail({ ...mail, to: user.email });
}

export async function sendReset(user: Pick<User, 'id' | 'name' | 'email'>): Promise<void> {
  const token = await issueToken(user.id, 'password_reset');
  const mail = resetEmail(user.name, resetLink(token));
  await sendMail({ ...mail, to: user.email });
}

/* ───────────────────── Protección de fuerza bruta ───────────────────── */

/**
 * Doble barrera, persistida en base de datos para que sobreviva a reinicios:
 *  - por cuenta: bloquea la cuenta tras N fallos seguidos;
 *  - por IP: frena el barrido de muchas cuentas desde un mismo origen.
 */
export async function assertNotLocked(email: string, ip: string): Promise<void> {
  const since = new Date(Date.now() - env.LOGIN_LOCK_MINUTES * 60_000);

  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ipHash: hashIp(ip) ?? '', success: false, createdAt: { gte: since } } }),
  ]);

  if (byEmail >= env.MAX_LOGIN_ATTEMPTS) {
    throw tooMany(
      `Demasiados intentos fallidos para esta cuenta. Vuelve a intentar en ${env.LOGIN_LOCK_MINUTES} minutos o restablece tu contraseña.`,
    );
  }
  if (byIp >= env.MAX_LOGIN_ATTEMPTS * 4) {
    throw tooMany('Demasiados intentos fallidos desde esta conexión. Intenta más tarde.');
  }
}

export const recordAttempt = (email: string, ip: string, success: boolean) =>
  prisma.loginAttempt.create({ data: { email, ipHash: hashIp(ip) ?? 'unknown', success } });

/* ─────────────────────────── Registro y login ─────────────────────────── */

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  accountType: 'comprador' | 'establecimiento';
  establishment?: { name: string; type: 'supermercado' | 'restaurante'; address: string; city: string; schedule?: string };
  /** Autorización de tratamiento de datos. Obligatoria (Ley 1581 de 2012). */
  consent: { accepted: true; version: string; marketing: boolean };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // El correo ya existe: se informa sin revelar nada más de la cuenta.
    throw conflict('Ya existe una cuenta con ese correo. Inicia sesión o restablece tu contraseña.');
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        // El rol público siempre es cliente. Un establecimiento se habilita al
        // aprobar la solicitud; superadmin nunca sale de este camino.
        role: 'cliente',
        status: 'activo',
        phoneEncrypted: input.phone ? encrypt(input.phone) : null,
        avatarHue: 140 + Math.floor(Math.random() * 180),
        // Evidencia del consentimiento. El momento lo pone el servidor: la
        // fecha que mande el cliente no prueba nada.
        consentVersion: input.consent.version,
        consentAcceptedAt: new Date(),
        consentMarketing: input.consent.marketing,
      },
    });

    let request = null;
    if (input.accountType === 'establecimiento' && input.establishment) {
      request = await tx.establishmentRequest.create({
        data: {
          userId: user.id,
          establishmentName: input.establishment.name,
          type: input.establishment.type,
          address: input.establishment.address,
          city: input.establishment.city,
          schedule: input.establishment.schedule ?? 'Lun a Dom · 8:00 – 20:00',
          contactPhoneEnc: input.phone ? encrypt(input.phone) : null,
        },
      });
      await tx.notification.create({
        data: {
          type: 'establishment_request',
          title: 'Nueva solicitud de establecimiento',
          body: `${input.establishment.name} (${input.establishment.city}) espera aprobación.`,
          data: { requestId: request.id },
        },
      });
    }

    return { user, request };
  });
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { select: { establishmentId: true } } },
  });

  // Mensaje idéntico exista o no la cuenta: no se filtra qué correos hay.
  const invalid = unauthorized('Correo o contraseña incorrectos.');

  if (!user || user.deletedAt) throw invalid;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw tooMany('La cuenta está bloqueada temporalmente por intentos fallidos.');
  }
  if (user.status === 'suspendido') {
    throw unauthorized('Esta cuenta está suspendida. Escribe a soporte@reverde.app.');
  }
  // Las cuentas de demostración solo funcionan si el ambiente las habilita.
  if (user.isDemo && !env.demoEnabled) {
    throw unauthorized('Las cuentas de demostración están deshabilitadas en este ambiente.');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil:
          failed >= env.MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60_000) : null,
      },
    });
    throw invalid;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw badRequest('La contraseña actual no es correcta.');
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw badRequest('La nueva contraseña debe ser distinta de la actual.');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}
