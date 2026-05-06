-- Migration: recurring_phase1
-- Additive only — no backfills, no destructive operations.
-- Applies to: RecurringInvoice (new columns), Document (isRecurring flag),
--             RecurringInvoiceRun (new table), Business (implicit via FK).

-- ---------------------------------------------------------------------------
-- 1. Additive columns on RecurringInvoice (all nullable / defaulted)
-- ---------------------------------------------------------------------------

ALTER TABLE "RecurringInvoice"
  ADD COLUMN IF NOT EXISTS "name"              VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "autoPaymentLink"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoReminder"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastFailureReason" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "cancelledAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledBy"       TEXT,
  ADD COLUMN IF NOT EXISTS "createdBy"         TEXT,
  ADD COLUMN IF NOT EXISTS "updatedBy"         TEXT,
  ADD COLUMN IF NOT EXISTS "claimedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimedBy"         VARCHAR(80);

-- New indexes for cron picker and party lookups
CREATE INDEX IF NOT EXISTS "RecurringInvoice_businessId_partyId_idx"
  ON "RecurringInvoice"("businessId", "partyId");

CREATE INDEX IF NOT EXISTS "RecurringInvoice_status_claimedAt_idx"
  ON "RecurringInvoice"("status", "claimedAt");

-- ---------------------------------------------------------------------------
-- 2. isRecurring flag on Document (marks documents used as recurring templates)
-- ---------------------------------------------------------------------------

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. New table: RecurringInvoiceRun
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "RecurringInvoiceRun" (
  "id"                  TEXT NOT NULL,
  "recurringInvoiceId"  TEXT NOT NULL,
  "businessId"          TEXT NOT NULL,
  "scheduledFor"        TIMESTAMP(3) NOT NULL,
  "ranAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"              TEXT NOT NULL,
  "generatedDocumentId" TEXT,
  "paymentLinkId"       TEXT,
  "idempotencyKey"      TEXT NOT NULL,
  "errorMessage"        VARCHAR(500),
  "warning"             VARCHAR(120),
  "retryCount"          INTEGER NOT NULL DEFAULT 0,
  "triggeredBy"         TEXT NOT NULL,
  "isDeleted"           BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecurringInvoiceRun_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "RecurringInvoiceRun_generatedDocumentId_key"
    UNIQUE ("generatedDocumentId"),

  CONSTRAINT "RecurringInvoiceRun_recurringInvoiceId_fkey"
    FOREIGN KEY ("recurringInvoiceId")
    REFERENCES "RecurringInvoice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "RecurringInvoiceRun_businessId_fkey"
    FOREIGN KEY ("businessId")
    REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "RecurringInvoiceRun_generatedDocumentId_fkey"
    FOREIGN KEY ("generatedDocumentId")
    REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Unique constraint on idempotencyKey — last-line defence against double-generation
CREATE UNIQUE INDEX IF NOT EXISTS "RecurringInvoiceRun_idempotencyKey_key"
  ON "RecurringInvoiceRun"("idempotencyKey");

-- Indexes for run history queries (newest first per schedule)
CREATE INDEX IF NOT EXISTS "RecurringInvoiceRun_recurringInvoiceId_ranAt_idx"
  ON "RecurringInvoiceRun"("recurringInvoiceId", "ranAt" DESC);

CREATE INDEX IF NOT EXISTS "RecurringInvoiceRun_businessId_status_idx"
  ON "RecurringInvoiceRun"("businessId", "status");

CREATE INDEX IF NOT EXISTS "RecurringInvoiceRun_scheduledFor_status_idx"
  ON "RecurringInvoiceRun"("scheduledFor", "status");
