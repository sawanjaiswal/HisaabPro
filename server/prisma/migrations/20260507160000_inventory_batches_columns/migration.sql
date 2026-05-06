-- BAT-01a: Phase 2.2 batch + expiry — additive columns only.
-- Applied via: psql $DATABASE_URL -f server/prisma/migrations/20260507160000_inventory_batches_columns/migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507160000_inventory_batches_columns --schema server/prisma/schema.prisma

-- 1. Business policy for expired-batch sales (decoupled from stockValidationMode).
--    expiredBatchPolicy: WARN_ONLY (default) | HARD_BLOCK — independent gate from low-stock policy.
--    expiryAlertDays: advance window for EXPIRY_NEAR cron; 0 = no advance alerts; NULL = inherit default 30.
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "expiryAlertDays"    INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "expiredBatchPolicy" TEXT    NOT NULL DEFAULT 'WARN_ONLY';

-- 2. StockAlert links to a specific batch for EXPIRY_NEAR / EXPIRY_PASSED rows.
--    FK is SET NULL on batch deletion so old alerts are not orphaned.
ALTER TABLE "StockAlert"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;

ALTER TABLE "StockAlert"
  ADD CONSTRAINT "StockAlert_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. StockVerificationItem can reference a specific batch (NULL = product-level count).
--    FK is SET NULL on batch deletion for the same reason.
ALTER TABLE "StockVerificationItem"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;

ALTER TABLE "StockVerificationItem"
  ADD CONSTRAINT "StockVerificationItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Pharmacy backfill: existing pharmacy businesses → HARD_BLOCK on expired batches.
--    Uses businessType column on Business (no BusinessProfile table in this schema).
UPDATE "Business"
   SET "expiredBatchPolicy" = 'HARD_BLOCK'
 WHERE "businessType" = 'pharmacy'
   AND "expiredBatchPolicy" = 'WARN_ONLY';
