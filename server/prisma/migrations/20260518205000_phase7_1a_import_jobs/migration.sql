-- Phase 7 Slice 7.1A — Bulk Import (Parties)
-- ARCH: docs/ARCHITECTURE_PHASE7_IMPORT_7_1A.md §2 (data model)
-- SECURITY: SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3 — idempotencyKey binds
--   POST /commit body to the originating preview (anti-replay + anti-cross-job).
--
-- Additive-only: Party gets two NULLABLE columns + two FKs + two indexes.
-- Two new tables: ImportJob (header) + ImportJobRow (per-row staging).
-- No NOT NULL backfill needed — legacy parties have no source job.

-- ─────────────────────────────────────────────────────────────────────────────
-- AlterTable — Party additive columns (both nullable, additive)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Party"
  ADD COLUMN "importJobId" TEXT,
  ADD COLUMN "importedBy"  TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- CreateTable — ImportJob (header)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "ImportJob" (
    "id"              TEXT NOT NULL,
    "businessId"      TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "entity"          TEXT NOT NULL,
    "format"          TEXT NOT NULL,
    "status"          TEXT NOT NULL,
    "commitToken"     TEXT,
    "idempotencyKey"  TEXT,
    "fileName"        TEXT,
    "fileSha256"      TEXT NOT NULL,
    "fileSize"        INTEGER NOT NULL,
    "rowCount"        INTEGER NOT NULL DEFAULT 0,
    "errorCount"      INTEGER NOT NULL DEFAULT 0,
    "columnMapping"   JSONB,
    "counts"          JSONB NOT NULL DEFAULT '{}',
    "createdPartyIds" JSONB NOT NULL DEFAULT '[]',
    "clientVersion"   TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "committedAt"     TIMESTAMP(3),
    "expiresAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CreateTable — ImportJobRow (per-row staging)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "ImportJobRow" (
    "id"             TEXT NOT NULL,
    "jobId"          TEXT NOT NULL,
    "sourceIndex"    INTEGER NOT NULL,
    "status"         TEXT NOT NULL,
    "raw"            JSONB,
    "normalized"     JSONB,
    "issues"         JSONB NOT NULL DEFAULT '[]',
    "dedupAction"    TEXT,
    "matchedPartyId" TEXT,
    "createdPartyId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJobRow_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — ImportJob
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "ImportJob_commitToken_key"          ON "ImportJob"("commitToken");
CREATE INDEX        "ImportJob_businessId_fileSha256_idx" ON "ImportJob"("businessId", "fileSha256");
CREATE INDEX        "ImportJob_businessId_status_updatedAt_idx" ON "ImportJob"("businessId", "status", "updatedAt");
CREATE INDEX        "ImportJob_committedAt_idx"           ON "ImportJob"("committedAt");
CREATE INDEX        "ImportJob_expiresAt_idx"             ON "ImportJob"("expiresAt");
CREATE INDEX        "ImportJob_userId_idx"                ON "ImportJob"("userId");

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — ImportJobRow
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "ImportJobRow_createdPartyId_key"     ON "ImportJobRow"("createdPartyId");
CREATE UNIQUE INDEX "ImportJobRow_jobId_sourceIndex_key"  ON "ImportJobRow"("jobId", "sourceIndex");
CREATE INDEX        "ImportJobRow_jobId_status_idx"       ON "ImportJobRow"("jobId", "status");

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — Party (new for Phase 7)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX "Party_importJobId_idx"             ON "Party"("importJobId");
CREATE INDEX "Party_businessId_importJobId_idx" ON "Party"("businessId", "importJobId");

-- ─────────────────────────────────────────────────────────────────────────────
-- Foreign keys
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Party"
  ADD CONSTRAINT "Party_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Party"
  ADD CONSTRAINT "Party_importedBy_fkey"
  FOREIGN KEY ("importedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportJobRow"
  ADD CONSTRAINT "ImportJobRow_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJobRow"
  ADD CONSTRAINT "ImportJobRow_matchedPartyId_fkey"
  FOREIGN KEY ("matchedPartyId") REFERENCES "Party"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportJobRow"
  ADD CONSTRAINT "ImportJobRow_createdPartyId_fkey"
  FOREIGN KEY ("createdPartyId") REFERENCES "Party"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
