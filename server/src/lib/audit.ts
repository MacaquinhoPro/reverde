/** Bitácora de auditoría. Nunca guarda cuerpos de petición completos. */
import type { Request } from 'express';
import { prisma } from './prisma.ts';
import { hashIp } from './crypto.ts';
import { clientIp } from './http.ts';
import { logger } from './logger.ts';

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  establishmentId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function audit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        establishmentId: input.establishmentId ?? null,
        actorUserId: req?.auth?.user.id ?? null,
        actorRole: req?.auth?.user.role ?? null,
        ipHash: req ? hashIp(clientIp(req)) : null,
        userAgent: req?.headers['user-agent']?.slice(0, 250) ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    });
  } catch (error) {
    // La auditoría no debe tumbar la operación principal.
    logger.error({ err: error, action: input.action }, 'no se pudo registrar la auditoría');
  }
}
