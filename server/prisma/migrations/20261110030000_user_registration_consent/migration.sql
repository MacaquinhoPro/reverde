-- Prueba de la autorización de tratamiento de datos otorgada al registrarse
-- (Ley 1581 de 2012, art. 9). Nullable porque las cuentas creadas antes de
-- esta migración no tienen la evidencia: no se puede inventar un
-- consentimiento retroactivo.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentVersion" TEXT;
