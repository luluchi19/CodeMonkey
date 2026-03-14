-- AlterTable
ALTER TABLE "review" ADD COLUMN     "estimatedCost" DOUBLE PRECISION,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER;
