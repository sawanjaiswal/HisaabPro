-- Phase 7 · Slice 7.1B · Migration B2 — StockMovement.importJobRowId partial UNIQUE
-- ARCHITECTURE_PHASE7_IMPORT_7_1B.md §4 Migration B.
--
-- Idempotency anchor for product opening-balance ledger rows (SCOPE L195-197,
-- L255, Gap 2). On commit-retry, an INSERT with the same `importJobRowId`
-- collides at the DB → ON CONFLICT DO NOTHING returns 0 rows → no duplicate
-- StockMovement row → `currentStock` (rolled from ledger) never doubles.
--
-- Partial index — only rows that came from an import are covered. Non-import
-- StockMovement rows (POS sales, manual adjustments) leave `importJobRowId`
-- NULL and are not subject to the constraint.
CREATE UNIQUE INDEX "unique_stock_movement_import_row"
  ON "StockMovement" ("importJobRowId")
  WHERE "importJobRowId" IS NOT NULL;
