import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Sesión resuelta por el middleware de autenticación. */
      auth?: {
        sessionId: string;
        user: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          emailVerified: boolean;
          establishmentIds: string[];
        };
      };
      /** Establecimiento sobre el que opera la petición (multi-tenant). */
      establishmentId?: string;
      requestId?: string;
    }
  }
}

export {};
