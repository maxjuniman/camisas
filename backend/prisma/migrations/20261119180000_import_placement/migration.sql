ALTER TABLE "ScrapingJob" ADD COLUMN "sportId" TEXT;
ALTER TABLE "ScrapingJob" ADD COLUMN "countryId" TEXT;

ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
