-- INV-01: Phase 2 inventory hardening — additive only.
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507130000_inventory_phase2_reorder

-- 1. Reorder quantity (nullable: null = not set, 0 = explicit zero).
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "reorderQty" DOUBLE PRECISION;

-- 2. Partial index for the low-stock list query (covers the hot path).
--    CREATE INDEX CONCURRENTLY must run outside a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_lowStock_idx"
  ON "Product" ("businessId", "currentStock")
  WHERE "minStockLevel" > 0
    AND "currentStock" <= "minStockLevel"
    AND "isDeleted" = false;
