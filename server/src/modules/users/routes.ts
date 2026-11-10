/**
 * Usuarios. El perfil propio vive en /api/auth/me; aquí está la consulta
 * pública mínima y la administración delegada.
 */
import { Router } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, param } from '../../lib/http.ts';
import { notFound } from '../../lib/errors.ts';
import { orderDTO, userDTO } from '../../domain/serialize.ts';
import { decrypt } from '../../lib/crypto.ts';
import { audit } from '../../lib/audit.ts';
import { requireAuth } from '../../middleware/auth.ts';
import { requirePermission } from '../../middleware/rbac.ts';

export const usersRouter = Router();

usersRouter.use(requireAuth);

/** Ficha mínima de otra persona: solo con permiso de lectura de usuarios. */
usersRouter.get(
  '/:id',
  requirePermission('users:read'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: param(req, 'id'), deletedAt: null },
      include: { memberships: { select: { establishmentId: true } } },
    });
    if (!user) throw notFound('La persona no existe.');
    return ok(res, userDTO(user));
  }),
);

/**
 * Derecho de acceso y portabilidad (Ley 1581 de 2012, art. 8).
 *
 * Devuelve **todo** lo que la plataforma guarda sobre la persona, en un formato
 * que se puede leer y llevar a otra parte. Tres decisiones:
 *
 *  - Los datos cifrados (teléfono, documento) se devuelven **descifrados**: el
 *    derecho es a conocer el dato, no su criptograma. Por eso el endpoint exige
 *    sesión propia y queda registrado en la bitácora de auditoría.
 *  - El hash de la contraseña **nunca** sale: no es un dato que el titular
 *    necesite y publicarlo solo ayudaría a quien robe el archivo.
 *  - Se incluye la prueba del consentimiento de cada pedido (versión, fecha y
 *    finalidad), porque es la evidencia de que el tratamiento fue autorizado.
 */
usersRouter.get(
  '/me/export',
  asyncHandler(async (req, res) => {
    const id = req.auth!.user.id;

    const [user, orders, notifications, memberships, sessions, consentLog] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id },
        include: { memberships: { select: { establishmentId: true } } },
      }),
      prisma.order.findMany({
        where: { userId: id },
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
      prisma.establishmentUser.findMany({
        where: { userId: id },
        include: { establishment: { select: { name: true, slug: true, city: true } } },
      }),
      prisma.session.findMany({
        where: { userId: id },
        select: { createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true, userAgent: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: { actorUserId: id },
        select: { action: true, entity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    await audit(req, { action: 'users.export', entity: 'User', entityId: id });

    return ok(res, {
      generadoEl: new Date().toISOString(),
      aviso:
        'Copia de los datos personales que Reverde trata sobre ti, entregada en ejercicio del ' +
        'derecho de acceso y portabilidad (Ley 1581 de 2012). No incluye el hash de tu contraseña, ' +
        'que no es legible ni para nosotros.',
      cuenta: {
        ...userDTO(user),
        // Descifrados: el derecho es a conocer el dato, no su criptograma.
        telefono: decrypt(user.phoneEncrypted),
        documento: decrypt(user.documentEncrypted),
        ultimoAcceso: user.lastLoginAt?.toISOString() ?? null,
        actualizadoEl: user.updatedAt.toISOString(),
      },
      establecimientos: memberships.map((m) => ({
        rol: m.role as string,
        desde: m.createdAt.toISOString(),
        establecimiento: m.establishment,
      })),
      pedidos: orders.map(orderDTO),
      /** Evidencia de la autorización otorgada en cada pedido. */
      consentimientos: orders
        .filter((o) => o.consentAcceptedAt)
        .map((o) => ({
          pedido: o.code,
          version: o.consentVersion,
          aceptadoEl: o.consentAcceptedAt?.toISOString() ?? null,
          finalidad: o.consentPurpose,
        })),
      notificaciones: notifications.map((n) => ({
        tipo: n.type,
        titulo: n.title,
        cuerpo: n.body,
        creadaEl: n.createdAt.toISOString(),
        leidaEl: n.readAt?.toISOString() ?? null,
      })),
      sesiones: sessions.map((s) => ({
        iniciadaEl: s.createdAt.toISOString(),
        ultimoUso: s.lastUsedAt.toISOString(),
        expiraEl: s.expiresAt.toISOString(),
        revocadaEl: s.revokedAt?.toISOString() ?? null,
        dispositivo: s.userAgent,
      })),
      /** Qué acciones hiciste. No incluye la IP: se guarda solo su hash. */
      actividad: consentLog.map((a) => ({
        accion: a.action,
        entidad: a.entity,
        fecha: a.createdAt.toISOString(),
      })),
    });
  }),
);

/**
 * Borrado de la propia cuenta. Es una baja lógica con anonimización: el
 * histórico de ventas del establecimiento debe seguir cuadrando, así que no
 * se borran las filas, se desvincula la identidad.
 */
usersRouter.delete(
  '/me',
  asyncHandler(async (req, res) => {
    const id = req.auth!.user.id;
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'suspendido',
          name: 'Cuenta eliminada',
          email: `eliminado+${id}@reverde.invalid`,
          phoneEncrypted: null,
          documentEncrypted: null,
        },
      }),
      prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.cartItem.deleteMany({ where: { cart: { userId: id } } }),
    ]);
    return ok(res, { message: 'Tu cuenta fue eliminada.' });
  }),
);
