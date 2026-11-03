/**
 * Control de acceso por rol y por permiso.
 *
 * Los permisos viven en la base de datos (tablas Permission y RolePermission)
 * y se cachean en memoria: así la matriz se puede ajustar sin desplegar código
 * y el chequeo sigue costando nada.
 */
import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';
import { forbidden, unauthorized } from '../lib/errors.ts';

let cache: Map<UserRole, Set<string>> | null = null;
let loadedAt = 0;
const TTL_MS = 60_000;

async function matrix(): Promise<Map<UserRole, Set<string>>> {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await prisma.rolePermission.findMany();
  const next = new Map<UserRole, Set<string>>();
  for (const row of rows) {
    const set = next.get(row.roleCode) ?? new Set<string>();
    set.add(row.permissionCode);
    next.set(row.roleCode, set);
  }
  cache = next;
  loadedAt = Date.now();
  return next;
}

export const invalidatePermissionCache = () => {
  cache = null;
};

/** Exige uno de los roles indicados. */
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (roles.includes(req.auth.user.role)) return next();
    next(forbidden('Tu rol no tiene acceso a esta sección.'));
  };

/** Exige un permiso concreto según la matriz rol → permisos. */
export const requirePermission =
  (permission: string): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    matrix()
      .then((m) => {
        if (m.get(req.auth!.user.role)?.has(permission)) return next();
        next(forbidden(`Tu rol no tiene el permiso «${permission}».`));
      })
      .catch(next);
  };

export const isSuperadmin = (req: { auth?: { user: { role: UserRole } } }) => req.auth?.user.role === 'superadmin';

/** Catálogo de permisos. El seed lo sincroniza con la base de datos. */
export const PERMISSIONS = {
  'products:read': 'Ver el inventario del establecimiento',
  'products:write': 'Crear, editar y eliminar productos',
  'inventory:write': 'Mover existencias y registrar ajustes',
  'alerts:read': 'Ver alertas de vencimiento',
  'alerts:write': 'Silenciar y resolver alertas',
  'recommendations:read': 'Ver recomendaciones del motor de riesgo',
  'recommendations:apply': 'Aplicar acciones recomendadas',
  'marketplace:publish': 'Publicar y despublicar en el marketplace',
  'marketplace:browse': 'Explorar el marketplace público',
  'dashboard:read': 'Ver métricas del establecimiento',
  'cart:write': 'Gestionar el carrito de compras',
  'orders:create': 'Crear pedidos',
  'orders:read:own': 'Ver sus propios pedidos',
  'orders:read:establishment': 'Ver los pedidos del establecimiento',
  'orders:manage': 'Cambiar el estado logístico de los pedidos',
  'payments:checkout': 'Iniciar un pago',
  'establishments:read': 'Ver establecimientos',
  'establishments:write': 'Crear y editar establecimientos',
  'establishments:request': 'Solicitar una cuenta de establecimiento',
  'users:read': 'Ver usuarios de la plataforma',
  'users:manage': 'Administrar usuarios y roles',
  'platform:read': 'Ver métricas globales de la plataforma',
  'platform:manage': 'Administrar la plataforma',
  'audit:read': 'Consultar la bitácora de auditoría',
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

/** Matriz rol → permisos que siembra el seed. */
export const ROLE_PERMISSIONS: Record<UserRole, PermissionCode[]> = {
  cliente: [
    'marketplace:browse',
    'cart:write',
    'orders:create',
    'orders:read:own',
    'payments:checkout',
    'establishments:read',
    'establishments:request',
  ],
  supermercado: [
    'products:read',
    'products:write',
    'inventory:write',
    'alerts:read',
    'alerts:write',
    'recommendations:read',
    'recommendations:apply',
    'marketplace:publish',
    'marketplace:browse',
    'dashboard:read',
    'orders:read:establishment',
    'orders:manage',
    'establishments:read',
  ],
  restaurante: [
    'products:read',
    'products:write',
    'inventory:write',
    'alerts:read',
    'alerts:write',
    'recommendations:read',
    'recommendations:apply',
    'marketplace:publish',
    'marketplace:browse',
    'dashboard:read',
    'orders:read:establishment',
    'orders:manage',
    'establishments:read',
  ],
  superadmin: Object.keys(PERMISSIONS) as PermissionCode[],
};
