-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "consentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "consentPurpose" TEXT,
ADD COLUMN     "consentVersion" TEXT;
