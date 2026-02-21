/*
  Warnings:

  - You are about to drop the column `subscriptionsStatus` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionsTier` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "subscriptionsStatus",
DROP COLUMN "subscriptionsTier",
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE';
