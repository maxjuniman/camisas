ALTER TABLE "ScrapingJob" ADD COLUMN "cursor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScrapingJob" ADD COLUMN "queue" JSONB;

DROP INDEX IF EXISTS "ScrapingJob_one_active";

CREATE UNIQUE INDEX "ScrapingJob_one_active" ON "ScrapingJob" ((1)) WHERE "status" IN ('QUEUED'::"JobStatus", 'RUNNING'::"JobStatus", 'PAUSED'::"JobStatus");
