-- Payments & Collections Hub — PR 1: Schema Migration
-- Architecture: docs/payments-hub/ARCHITECTURE.md §1
-- Security: docs/payments-hub/SECURITY_AUDIT.md §MB-7
-- All changes are additive. No data loss. Rollback notes in -- DOWN block.

-- ============================================================
-- 1. Enums
-- ============================================================

CREATE TYPE "PromiseToPayStatus" AS ENUM ('OPEN', 'KEPT', 'BROKEN', 'CANCELLED');

CREATE TYPE "PaymentLinkStatus" AS ENUM (
  'CREATED',
  'ACTIVE',
  'PAID',
  'PARTIALLY_PAID',
  'EXPIRED',
  'CANCELLED',
  'FAILED'
);

CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP', 'SMS', 'PUSH', 'EMAIL');

CREATE TYPE "ReminderDispatchStatus" AS ENUM ('QUEUED', 'DISPATCHED', 'DELIVERED', 'FAILED');

CREATE TYPE "CadenceTrigger" AS ENUM (
  'ON_DUE_DATE',
  'AFTER_DUE_DAYS',
  'AFTER_LAST_REMINDER_DAYS'
);

-- ============================================================
-- 2. PromiseToPay
-- ============================================================

CREATE TABLE "PromiseToPay" (
    "id"                     TEXT NOT NULL,
    "businessId"             TEXT NOT NULL,
    "partyId"                TEXT NOT NULL,
    "invoiceId"              TEXT,                          -- nullable: PTP can be party-wide

    "amountPaise"            INTEGER NOT NULL,              -- paise, > 0
    "promiseDate"            TIMESTAMP(3) NOT NULL,
    "status"                 "PromiseToPayStatus" NOT NULL DEFAULT 'OPEN',
    "notes"                  VARCHAR(500),

    -- Resolution timestamps
    "keptAt"                 TIMESTAMP(3),
    "brokenAt"               TIMESTAMP(3),
    "cancelledAt"            TIMESTAMP(3),
    "cancelReason"           VARCHAR(500),

    -- Denormalised payment ids that satisfied this PTP (Postgres TEXT[])
    "satisfyingPaymentIds"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    -- Offline idempotency
    "clientId"               TEXT,

    -- Soft-delete trio (PTP only — others are append-only or have explicit cancel states)
    "isDeleted"              BOOLEAN NOT NULL DEFAULT false,
    "deletedAt"              TIMESTAMP(3),
    "deletedBy"              TEXT,

    -- Audit columns
    "createdBy"              TEXT NOT NULL,
    "updatedBy"              TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromiseToPay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromiseToPay_clientId_key" ON "PromiseToPay"("clientId")
    WHERE "clientId" IS NOT NULL;

CREATE INDEX "PromiseToPay_businessId_status_idx"      ON "PromiseToPay"("businessId", "status");
CREATE INDEX "PromiseToPay_businessId_partyId_idx"     ON "PromiseToPay"("businessId", "partyId");
CREATE INDEX "PromiseToPay_businessId_promiseDate_status_idx"
    ON "PromiseToPay"("businessId", "promiseDate", "status");
CREATE INDEX "PromiseToPay_businessId_isDeleted_idx"   ON "PromiseToPay"("businessId", "isDeleted");
CREATE INDEX "PromiseToPay_clientId_idx"               ON "PromiseToPay"("clientId");

ALTER TABLE "PromiseToPay"
    ADD CONSTRAINT "PromiseToPay_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "PromiseToPay_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "PromiseToPay_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. PaymentLink
-- ============================================================

CREATE TABLE "PaymentLink" (
    "id"                     TEXT NOT NULL,
    "businessId"             TEXT NOT NULL,
    "invoiceId"              TEXT NOT NULL,               -- per-invoice in MVP
    "partyId"                TEXT NOT NULL,               -- denormalised for index

    -- Razorpay state
    "razorpayLinkId"         TEXT,                        -- null until Razorpay confirms
    "shortUrl"               TEXT,                        -- null until ACTIVE
    "amountPaise"            INTEGER NOT NULL,
    "currency"               VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status"                 "PaymentLinkStatus" NOT NULL DEFAULT 'CREATED',

    -- Lifecycle
    "expireBy"               TIMESTAMP(3) NOT NULL,
    "expiredAt"              TIMESTAMP(3),
    "paidAt"                 TIMESTAMP(3),
    "paidAmountPaise"        INTEGER NOT NULL DEFAULT 0,
    "cancelledAt"            TIMESTAMP(3),

    -- Customer-facing copy (kept for audit)
    "description"            VARCHAR(280),
    "notifyChannels"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    -- Idempotency
    "createIdempotencyKey"   TEXT,

    -- Webhook trail
    "lastWebhookEvent"       VARCHAR(64),
    "lastWebhookAt"          TIMESTAMP(3),

    -- Audit + soft delete
    "isDeleted"              BOOLEAN NOT NULL DEFAULT false,
    "deletedAt"              TIMESTAMP(3),
    "deletedBy"              TEXT,
    "createdBy"              TEXT NOT NULL,
    "updatedBy"              TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentLink_razorpayLinkId_key"        ON "PaymentLink"("razorpayLinkId")
    WHERE "razorpayLinkId" IS NOT NULL;
CREATE UNIQUE INDEX "PaymentLink_createIdempotencyKey_key"  ON "PaymentLink"("createIdempotencyKey")
    WHERE "createIdempotencyKey" IS NOT NULL;

CREATE INDEX "PaymentLink_businessId_status_idx"       ON "PaymentLink"("businessId", "status");
CREATE INDEX "PaymentLink_businessId_invoiceId_idx"    ON "PaymentLink"("businessId", "invoiceId");
CREATE INDEX "PaymentLink_businessId_partyId_idx"      ON "PaymentLink"("businessId", "partyId");
CREATE INDEX "PaymentLink_expireBy_status_idx"         ON "PaymentLink"("expireBy", "status");
CREATE INDEX "PaymentLink_businessId_isDeleted_idx"    ON "PaymentLink"("businessId", "isDeleted");

ALTER TABLE "PaymentLink"
    ADD CONSTRAINT "PaymentLink_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "PaymentLink_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "PaymentLink_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. ReminderLog (append-only, no updatedAt)
-- ============================================================

CREATE TABLE "ReminderLog" (
    "id"                         TEXT NOT NULL,
    "businessId"                 TEXT NOT NULL,
    "partyId"                    TEXT NOT NULL,
    "invoiceId"                  TEXT,                    -- null for party-level/statement reminders

    -- Origin metadata
    "origin"                     VARCHAR(20) NOT NULL,    -- MANUAL | BULK | CADENCE
    "bulkBatchId"                VARCHAR(40),
    "cadenceId"                  TEXT,                    -- FK to CollectionCadence (Phase 2)

    "channel"                    "ReminderChannel" NOT NULL,
    "status"                     "ReminderDispatchStatus" NOT NULL DEFAULT 'QUEUED',

    -- Rendered message frozen at dispatch time
    "renderedMessage"            TEXT NOT NULL,
    "templateKey"                VARCHAR(40),

    -- Channel metadata
    "recipientPhone"             VARCHAR(20),             -- E.164; masked in app logs, not in DB
    "dispatchedAt"               TIMESTAMP(3),
    "failedAt"                   TIMESTAMP(3),
    "failureReason"              VARCHAR(500),

    -- Snapshot of outstanding at reminder time
    "snapshotOutstandingPaise"   INTEGER NOT NULL,

    "createdBy"                  TEXT NOT NULL,           -- userId or cron actor name
    "createdAt"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- No updatedAt — append-only audit log

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReminderLog_businessId_partyId_createdAt_idx"
    ON "ReminderLog"("businessId", "partyId", "createdAt" DESC);
CREATE INDEX "ReminderLog_businessId_invoiceId_createdAt_idx"
    ON "ReminderLog"("businessId", "invoiceId", "createdAt" DESC);
CREATE INDEX "ReminderLog_businessId_status_createdAt_idx"
    ON "ReminderLog"("businessId", "status", "createdAt" DESC);
CREATE INDEX "ReminderLog_businessId_bulkBatchId_idx"
    ON "ReminderLog"("businessId", "bulkBatchId");

ALTER TABLE "ReminderLog"
    ADD CONSTRAINT "ReminderLog_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ReminderLog_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ReminderLog_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. CollectionCadence (Phase 2 forward-compat shell)
-- ============================================================

CREATE TABLE "CollectionCadence" (
    "id"                 TEXT NOT NULL,
    "businessId"         TEXT NOT NULL,
    "name"               VARCHAR(80) NOT NULL,
    "enabled"            BOOLEAN NOT NULL DEFAULT false,
    "trigger"            "CadenceTrigger" NOT NULL,
    "triggerOffsetDays"  INTEGER NOT NULL DEFAULT 0,
    "channel"            "ReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateKey"        VARCHAR(40) NOT NULL,
    "quietHoursStart"    VARCHAR(5) NOT NULL DEFAULT '21:00',
    "quietHoursEnd"      VARCHAR(5) NOT NULL DEFAULT '09:00',

    -- Eligibility filters (JSON; all keys optional)
    "filters"            JSONB NOT NULL DEFAULT '{}',

    "isDeleted"          BOOLEAN NOT NULL DEFAULT false,
    "deletedAt"          TIMESTAMP(3),
    "createdBy"          TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionCadence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionCadence_businessId_name_key"
    ON "CollectionCadence"("businessId", "name");
CREATE INDEX "CollectionCadence_businessId_enabled_idx"
    ON "CollectionCadence"("businessId", "enabled");

ALTER TABLE "CollectionCadence"
    ADD CONSTRAINT "CollectionCadence_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 6. AuditLog.systemActor column (MB-7 — cron writes NULL userId)
-- ============================================================

ALTER TABLE "AuditLog"
    ADD COLUMN "systemActor" VARCHAR(50);

-- Allow AuditLog.userId to be nullable so cron rows can set systemActor instead.
-- (AuditLog.userId is currently NOT NULL with a FK; we make it optional for system actors)
ALTER TABLE "AuditLog"
    ALTER COLUMN "userId" DROP NOT NULL;

-- ============================================================
-- DOWN (manual rollback reference — Prisma does not run this block)
-- ============================================================
-- ALTER TABLE "AuditLog" ALTER COLUMN "userId" SET NOT NULL;
-- ALTER TABLE "AuditLog" DROP COLUMN "systemActor";
-- DROP TABLE "CollectionCadence";
-- DROP TABLE "ReminderLog";
-- DROP TABLE "PaymentLink";
-- DROP TABLE "PromiseToPay";
-- DROP TYPE "CadenceTrigger";
-- DROP TYPE "ReminderDispatchStatus";
-- DROP TYPE "ReminderChannel";
-- DROP TYPE "PaymentLinkStatus";
-- DROP TYPE "PromiseToPayStatus";
