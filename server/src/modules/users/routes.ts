/**
 * Usuarios. El perfil propio vive en /api/auth/me; aquí está la consulta
 * pública mínima y la administración delegada.
 */
import { Router } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { asyncHandler, ok, param } from '../../lib/http.ts';
import { notFound } from '../../lib/errors.ts';
import { userDTO } from '../../domain/serialize.ts';
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
