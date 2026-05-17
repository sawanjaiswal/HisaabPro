-- INV-01: Phase 2 inventory hardening — additive only.
-- Idempotent: safe to re-run via `prisma migrate deploy` (was previously
-- written for manual psql application with CONCURRENTLY; dropped because
-- Render auto-deploy wraps each migration in a transaction).

-- 1. Reorder quantity (nullable: null = not set, 0 = explicit zero).
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "reorderQty" DOUBLE PRECISION;

-- 2. Partial index for the low-stock list query (covers the hot path).
CREATE INDEX IF NOT EXISTS "Product_lowStock_idx"
  ON "Product" ("businessId", "currentStock")
  WHERE "minStockLevel" > 0
    AND "currentStock" <= "minStockLevel"
    AND "isDeleted" = false;
