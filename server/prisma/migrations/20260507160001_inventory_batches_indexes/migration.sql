-- BAT-01b: Phase 2.2 batch + expiry — indexes only.
-- CREATE INDEX CONCURRENTLY must run outside any transaction block;
-- Prisma wraps migration.sql in a transaction, so CONCURRENTLY lives here alone.
-- Applied via: psql $DATABASE_URL -f server/prisma/migrations/20260507160001_inventory_batches_indexes/migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507160001_inventory_batches_indexes --schema server/prisma/schema.prisma

-- FEFO selection: per-product, earliest non-null expiry first.
-- Partial: only live batches with stock — keeps the index small for the hot path.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Batch_productId_expiryDate_idx"
  ON "Batch" ("productId", "expiryDate" ASC NULLS LAST)
  WHERE "isDeleted" = false AND "currentStock" > 0;

-- Cron dedupe: one ACTIVE alert per (business, batch, alertType).
-- Partial: only rows that have a batchId (expiry alerts), not low-stock alerts.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockAlert_businessId_batchId_alertType_status_idx"
  ON "StockAlert" ("businessId", "batchId", "alertType", "status")
  WHERE "batchId" IS NOT NULL;

-- Verification by batch for quick lookup during count sessions.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockVerificationItem_batchId_idx"
  ON "StockVerificationItem" ("batchId")
  WHERE "batchId" IS NOT NULL;
