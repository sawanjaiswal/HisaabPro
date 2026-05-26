-- Phase 7 · Slice 7.1B · Migration B1 — entity-rename expand + StockMovement audit columns
-- ARCHITECTURE_PHASE7_IMPORT_7_1B.md §4 Migration A (subset — column-only expand).
--
-- Scope of THIS migration (additive, in-tx):
--   1. ImportJobRow.createdEntityId  TEXT NULL   — expand phase of the
--      `createdPartyId → createdEntityId` rename (SCOPE L199-218, Gap 1).
--      Backfilled from `createdPartyId` so existing parties jobs continue
--      to render via the new column.
--   2. StockMovement.importJobRowId  TEXT NULL FK → ImportJobRow(id)
--      ON DELETE SET NULL — idempotency anchor for product opening-balance
--      ledger rows (SCOPE L195-197, Gap 2). The partial UNIQUE on
--      `importJobRowId` lives in Migration B2 so the constraint can be
--      reviewed independently.
--
-- Out-of-scope (deferred to later migrations / PRs):
--   * Product.importJobId / Product.importedBy           → handled in slice 7.1B PR2
--   * StockMovement.importJobId                          → handled in slice 7.1B PR2
--   * `ImportJobRow_createdEntityId_key` UNIQUE          → flips to UNIQUE
--                                                          once dual-write
--                                                          backfill completes
--                                                          (PR-followup
--                                                          Migration D).
--   * DROP COLUMN "ImportJobRow"."createdPartyId"        → Migration D.

-- ── ImportJobRow — expand rename column (additive, backfilled) ──────────────
ALTER TABLE "ImportJobRow" ADD COLUMN "createdEntityId" TEXT;

UPDATE "ImportJobRow"
SET "createdEntityId" = "createdPartyId"
WHERE "createdPartyId" IS NOT NULL;

CREATE INDEX "ImportJobRow_jobId_createdEntityId_idx"
  ON "ImportJobRow" ("jobId", "createdEntityId");

-- ── StockMovement — importJobRowId column + FK ──────────────────────────────
ALTER TABLE "StockMovement" ADD COLUMN "importJobRowId" TEXT;

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_importJobRowId_fkey"
  FOREIGN KEY ("importJobRowId") REFERENCES "ImportJobRow"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
