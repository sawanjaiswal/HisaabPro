-- BAT-01b: Phase 2.2 batch + expiry — indexes only.
-- Idempotent: safe to re-run via `prisma migrate deploy` (was previously
-- written for manual psql application with CONCURRENTLY; dropped because
-- Render auto-deploy wraps each migration in a transaction).

-- FEFO selection: per-product, earliest non-null expiry first.
-- Partial: only live batches with stock — keeps the index small for the hot path.
CREATE INDEX IF NOT EXISTS "Batch_productId_expiryDate_idx"
  ON "Batch" ("productId", "expiryDate" ASC NULLS LAST)
  WHERE "isDeleted" = false AND "currentStock" > 0;

-- Cron dedupe: one ACTIVE alert per (business, batch, alertType).
-- Partial: only rows that have a batchId (expiry alerts), not low-stock alerts.
CREATE INDEX IF NOT EXISTS "StockAlert_businessId_batchId_alertType_status_idx"
  ON "StockAlert" ("businessId", "batchId", "alertType", "status")
  WHERE "batchId" IS NOT NULL;

-- Verification by batch for quick lookup during count sessions.
CREATE INDEX IF NOT EXISTS "StockVerificationItem_batchId_idx"
  ON "StockVerificationItem" ("batchId")
  WHERE "batchId" IS NOT NULL;
