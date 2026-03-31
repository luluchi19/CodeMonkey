-- AlterTable
ALTER TABLE "repository" ADD COLUMN     "indexMessage" TEXT,
ADD COLUMN     "indexStatus" TEXT NOT NULL DEFAULT 'ready',
ADD COLUMN     "indexedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "reviewSections" JSONB NOT NULL DEFAULT '[]';
