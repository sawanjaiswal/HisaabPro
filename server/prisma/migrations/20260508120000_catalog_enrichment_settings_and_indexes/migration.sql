-- Catalog Enrichment Phase 4 — additive only, no DROP, no backfill needed.
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260508120000_catalog_enrichment_settings_and_indexes

-- 1. DocumentSettings.enforceMoq — hard-block MOQ violations (default on)
ALTER TABLE "DocumentSettings"
  ADD COLUMN IF NOT EXISTS "enforceMoq" BOOLEAN NOT NULL DEFAULT true;

-- 2. DocumentSettings.showLineItemImages — opt-in product thumbs on invoices
ALTER TABLE "DocumentSettings"
  ADD COLUMN IF NOT EXISTS "showLineItemImages" BOOLEAN NOT NULL DEFAULT false;

-- 3. Document composite index for party ledger window queries
CREATE INDEX IF NOT EXISTS "Document_businessId_partyId_documentDate_idx"
  ON "Document"("businessId", "partyId", "documentDate");

-- 4. Payment composite index for party ledger window queries
CREATE INDEX IF NOT EXISTS "Payment_businessId_partyId_date_idx"
  ON "Payment"("businessId", "partyId", "date");
