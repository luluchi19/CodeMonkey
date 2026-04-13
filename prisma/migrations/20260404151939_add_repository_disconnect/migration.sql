-- AlterTable
ALTER TABLE "repository" ADD COLUMN     "disconnectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "reviewAuditEnabled" BOOLEAN NOT NULL DEFAULT false;
