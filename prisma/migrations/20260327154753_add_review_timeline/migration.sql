-- AlterTable
ALTER TABLE "review" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "review_event" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_event_reviewId_idx" ON "review_event"("reviewId");

-- AddForeignKey
ALTER TABLE "review_event" ADD CONSTRAINT "review_event_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
