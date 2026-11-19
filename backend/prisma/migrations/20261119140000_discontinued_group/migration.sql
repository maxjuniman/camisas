ALTER TYPE "MatchStatus" ADD VALUE 'DISCONTINUED';

ALTER TABLE "Product" ADD COLUMN "groupKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "groupSeenAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "discontinued" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScrapingJob" ADD COLUMN "removedCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Product_groupKey_idx" ON "Product"("groupKey");
