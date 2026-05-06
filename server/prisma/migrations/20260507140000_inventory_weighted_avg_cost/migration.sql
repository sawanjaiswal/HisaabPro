-- INV-03: Weighted-average cost per product (in paise).
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507140000_inventory_weighted_avg_cost

-- Weighted-average purchase cost, updated on every SAVED purchase invoice.
-- NULL means "no purchase ever recorded" (distinct from 0 = free item).
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "weightedAvgCostPaise" BIGINT DEFAULT 0;
