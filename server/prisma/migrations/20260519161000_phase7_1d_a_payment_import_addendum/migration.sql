-- Phase 7 · Slice 7.1D · Migration A — Payment import addendum (additive, expand-only)
-- ARCHITECTURE_PHASE7_IMPORT_7_1D.md §3.
--
-- Scope (in-tx):
--   1. Payment.importJobId TEXT NULL  FK ImportJob(id)  ON DELETE SET NULL
--   2. Payment.importedBy  TEXT NULL  FK User(id)       ON DELETE SET NULL
--   3. INDEX (importJobId)
--   4. INDEX (businessId, importJobId) — backs importer/cleanup queries.
--
-- Why expand-only is sufficient: both columns nullable + additive.
-- Existing Payment rows have importJobId=NULL, matching their reality
-- (hand-entered or Phase-5 offline-create). No backfill needed.
--
-- DPDP semantics: SetNull on both FKs preserves Payment ledger across
-- ImportJob hard-delete (90d post-terminal) and User erasure — Payment
-- rows remain queryable; only the provenance link is severed.

ALTER TABLE "Payment" ADD COLUMN "importJobId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "importedBy"  TEXT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_importedBy_fkey"
  FOREIGN KEY ("importedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_importJobId_idx"
  ON "Payment" ("importJobId");

CREATE INDEX "Payment_businessId_importJobId_idx"
  ON "Payment" ("businessId", "importJobId");
