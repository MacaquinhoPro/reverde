import { Router } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { env } from '../../config/env.ts';
import { asyncHandler, clientIp, created, ok, param, validate } from '../../lib/http.ts';
import { audit } from '../../lib/audit.ts';
import { decrypt, encrypt, maskTail } from '../../lib/crypto.ts';
import { hashPassword } from '../../lib/password.ts';
import { badRequest, forbidden, notFound, unauthorized } from '../../lib/errors.ts';
import { userDTO } from '../../domain/serialize.ts';
import { attachSession, issueSession, requireAuth, revokeAllSessions, revokeSession } from '../../middleware/auth.ts';
import { rateLimit } from '../../middleware/rateLimit.ts';
import {
  bootstrapSuperadminSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from './schemas.ts';
import {
  assertNotLocked,
  authenticate,
  changePassword,
  consumeToken,
  recordAttempt,
  registerUser,
  sendReset,
  sendVerification,
} from './service.ts';

export const authRouter = Router();

/** Límites estrechos en los puntos sensibles de autenticación. */
const strict = rateLimit({ max: env.isTest ? 1000 : 10, windowSeconds: 60, keyPrefix: 'auth' });

authRouter.use(attachSession);

/* ───────────────────────────── Registro ───────────────────────────── */

authRouter.post(
  '/register',
  strict,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { user, request } = await registerUser(req.body);
    await sendVerification(user);
    // La sesión se abre de una vez: el correo se puede confirmar después.
    await issueSession(req, res, user.id);
    await audit(req, {
      action: 'auth.register',
      entity: 'User',
      entityId: user.id,
      // La sesión se acaba de crear: el actor se indica explícitamente.
      actorUserId: user.id,
      actorRole: user.role,
      metadata: { accountType: req.body.accountType, requestId: request?.id ?? null },
    });
    return created(res, {
      user: userDTO(user),
      establishmentRequest: request ? { id: request.id, status: request.status } : null,
      message: request
        ? 'Cuenta creada. Tu solicitud de establecimiento quedó pendiente de aprobación.'
        : 'Cuenta creada. Revisa tu correo para confirmarlo.',
    });
  }),
);

/* ────────────────────────────── Sesión ────────────────────────────── */

authRouter.post(
  '/login',
  strict,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const ip = clientIp(req);
    await assertNotLocked(email, ip);
    try {
      const user = await authenticate(email, password);
      await recordAttempt(email, ip, true);
      await issueSession(req, res, user.id);
      await audit(req, { action: 'auth.login', entity: 'User', entityId: user.id, actorUserId: user.id, actorRole: user.role });
      return ok(res, { user: userDTO(user) });
    } catch (error) {
      await recordAttempt(email, ip, false);
      throw error;
    }
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const sessionId = req.auth?.sessionId;
    await revokeSession(res, sessionId);
    if (sessionId) await audit(req, { action: 'auth.logout', entity: 'Session', entityId: sessionId });
    return ok(res, { message: 'Sesión cerrada.' });
  }),
);

/** Estado de la sesión actual. Es también el endpoint de «refresh»: cada
 *  llamada renueva la ventana de vigencia de la cookie. */
authRouter.get(
  '/session',
  asyncHandler(async (req, res) => {
    if (!req.auth) return ok(res, { user: null, authenticated: false });
    const user = await prisma.user.findUnique({
      where: { id: req.auth.user.id },
      include: { memberships: { select: { establishmentId: true } } },
    });
    if (!user) throw unauthorized();
    return ok(res, { user: userDTO(user), authenticated: true, csrfCookie: env.CSRF_COOKIE_NAME });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.auth!.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true, userAgent: true },
    });
    return ok(
      res,
      sessions.map((s) => ({
        ...s,
        current: s.id === req.auth!.sessionId,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    );
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await prisma.session.updateMany({
      where: { id: param(req, 'id'), userId: req.auth!.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw notFound('Esa sesión no existe o ya estaba cerrada.');
    if (req.params.id === req.auth!.sessionId) await revokeSession(res);
    return ok(res, { message: 'Sesión revocada.' });
  }),
);

/* ─────────────────────── Verificación de correo ─────────────────────── */

authRouter.post(
  '/verify-email',
  strict,
  validate({ body: verifyEmailSchema }),
  asyncHandler(async (req, res) => {
    const user = await consumeToken(req.body.token, 'email_verification');
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      include: { memberships: { select: { establishmentId: true } } },
    });
    await audit(req, { action: 'auth.email_verified', entity: 'User', entityId: user.id });
    return ok(res, { user: userDTO(updated), message: 'Correo confirmado.' });
  }),
);

authRouter.post(
  '/verify-email/resend',
  strict,
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.user.id } });
    if (user.emailVerifiedAt) return ok(res, { message: 'Tu correo ya estaba confirmado.' });
    await sendVerification(user);
    return ok(res, { message: 'Te enviamos un nuevo enlace de confirmación.' });
  }),
);

/* ──────────────────────────── Contraseñas ──────────────────────────── */

authRouter.post(
  '/password/forgot',
  strict,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    // Respuesta idéntica exista o no la cuenta: no se enumeran correos.
    if (user && !user.deletedAt && user.status !== 'suspendido') await sendReset(user);
    return ok(res, {
      message: 'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.',
    });
  }),
);

authRouter.post(
  '/password/reset',
  strict,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    const user = await consumeToken(req.body.token, 'password_reset');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(req.body.password),
        failedLogins: 0,
        lockedUntil: null,
        // Restablecer la contraseña por correo confirma de paso la dirección.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    // Cambiar la contraseña cierra todas las sesiones abiertas.
    await revokeAllSessions(user.id);
    await revokeSession(res);
    await audit(req, { action: 'auth.password_reset', entity: 'User', entityId: user.id });
    return ok(res, { message: 'Contraseña actualizada. Inicia sesión con la nueva.' });
  }),
);

authRouter.post(
  '/password/change',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await changePassword(req.auth!.user.id, req.body.currentPassword, req.body.newPassword);
    // Se conserva la sesión actual y se cierran las demás.
    await prisma.session.updateMany({
      where: { userId: req.auth!.user.id, revokedAt: null, id: { not: req.auth!.sessionId } },
      data: { revokedAt: new Date() },
    });
    await audit(req, { action: 'auth.password_change', entity: 'User', entityId: req.auth!.user.id });
    return ok(res, { message: 'Contraseña actualizada. Se cerraron las otras sesiones.' });
  }),
);

/* ───────────────────────────── Mi perfil ───────────────────────────── */

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth!.user.id },
      include: { memberships: { include: { establishment: true } } },
    });
    return ok(res, {
      ...userDTO(user),
      // El teléfono se descifra solo para su titular, y enmascarado.
      phoneMasked: maskTail(decrypt(user.phoneEncrypted)),
      establishments: user.memberships.map((m) => ({
        id: m.establishmentId,
        name: m.establishment.name,
        role: m.role as string,
      })),
    });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const { name, phone, avatarHue } = req.body;
    const user = await prisma.user.update({
      where: { id: req.auth!.user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(avatarHue !== undefined ? { avatarHue } : {}),
        ...(phone !== undefined ? { phoneEncrypted: phone ? encrypt(phone) : null } : {}),
      },
      include: { memberships: { select: { establishmentId: true } } },
    });
    await audit(req, {
      action: 'user.profile_update',
      entity: 'User',
      entityId: user.id,
      // Se audita qué campos cambiaron, nunca sus valores.
      metadata: { fields: Object.keys(req.body) },
    });
    return ok(res, userDTO(user));
  }),
);

/* ────────────────── Alta del primer superadministrador ────────────────── */

/**
 * El rol de superadministrador no se puede pedir desde el registro público.
 * Se crea con un token de un solo uso (SUPERADMIN_BOOTSTRAP_TOKEN) que vive
 * en el gestor de secretos y que se retira después del alta; si ya existe un
 * superadministrador, este endpoint queda cerrado para siempre.
 */
authRouter.post(
  '/bootstrap-superadmin',
  rateLimit({ max: 5, windowSeconds: 3600, keyPrefix: 'bootstrap' }),
  validate({ body: bootstrapSuperadminSchema }),
  asyncHandler(async (req, res) => {
    if (!env.SUPERADMIN_BOOTSTRAP_TOKEN) throw forbidden('El alta de superadministrador no está habilitada.');
    if (req.body.token !== env.SUPERADMIN_BOOTSTRAP_TOKEN) throw forbidden('Token de alta inválido.');

    const already = await prisma.user.count({ where: { role: 'superadmin', deletedAt: null } });
    if (already > 0) {
      throw forbidden('Ya existe un superadministrador. Usa el panel para crear otros.');
    }
    if (await prisma.user.findUnique({ where: { email: req.body.email } })) {
      throw badRequest('Ese correo ya está registrado: asciéndelo desde el panel en su lugar.');
    }

    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        passwordHash: await hashPassword(req.body.password),
        role: 'superadmin',
        status: 'activo',
        emailVerifiedAt: new Date(),
      },
    });
    await audit(req, { action: 'auth.bootstrap_superadmin', entity: 'User', entityId: user.id, actorUserId: user.id, actorRole: user.role });
    return created(res, { user: userDTO(user), message: 'Superadministrador creado. Retira ya el token de alta.' });
  }),
);
