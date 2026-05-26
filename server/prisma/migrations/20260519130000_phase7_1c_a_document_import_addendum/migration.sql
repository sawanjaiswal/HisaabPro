-- Phase 7 · Slice 7.1C · Migration A — Document import addendum (additive, expand-only)
-- ARCHITECTURE_PHASE7_IMPORT_7_1C.md §3.
--
-- Scope (in-tx):
--   1. Document.importJobId TEXT NULL  FK ImportJob(id)  ON DELETE SET NULL
--   2. Document.importedBy  TEXT NULL  FK User(id)       ON DELETE SET NULL
--   3. INDEX (businessId, importJobId) — backs importer/cleanup queries.
--
-- Why expand-only is sufficient: both columns nullable + additive.
-- Existing Document rows have importJobId=NULL, which matches their
-- reality (they were not imported). No backfill needed.
--
-- ADR stub: If this migration ever runs against a multi-million-row
-- Document table, replace btree CREATE INDEX with CONCURRENTLY (and
-- add `-- prisma:no-transaction` on line 1). Pilot Document rowcount
-- < 5k makes the short ACCESS EXCLUSIVE hold acceptable for now.

ALTER TABLE "Document" ADD COLUMN "importJobId" TEXT;
ALTER TABLE "Document" ADD COLUMN "importedBy"  TEXT;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_importedBy_fkey"
  FOREIGN KEY ("importedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Document_businessId_importJobId_idx"
  ON "Document" ("businessId", "importJobId");
