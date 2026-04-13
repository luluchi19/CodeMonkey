-- AlterTable
ALTER TABLE "review" ADD COLUMN     "additions" INTEGER,
ADD COLUMN     "baseRef" TEXT,
ADD COLUMN     "changedFiles" INTEGER,
ADD COLUMN     "deletions" INTEGER,
ADD COLUMN     "headRef" TEXT,
ADD COLUMN     "prAuthor" TEXT,
ADD COLUMN     "prCreatedAt" TIMESTAMP(3),
ADD COLUMN     "prMergedAt" TIMESTAMP(3),
ADD COLUMN     "prState" TEXT;
