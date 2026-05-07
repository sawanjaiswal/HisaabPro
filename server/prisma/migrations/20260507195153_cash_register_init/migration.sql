-- Cash Register — Phase 1 additive migration
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507195153_cash_register_init

-- Enums

CREATE TYPE "CashEntryDirection" AS ENUM ('IN', 'OUT');

CREATE TYPE "CashEntryEventType" AS ENUM ('CREATED', 'EDITED', 'VOIDED', 'RESTORED', 'HARD_DELETED');

-- cash_entries table

CREATE TABLE "cash_entries" (
    "id"              TEXT         NOT NULL,
    "businessId"      TEXT         NOT NULL,
    "expression"      TEXT         NOT NULL,
    "amountPaise"     BIGINT       NOT NULL,
    "direction"       "CashEntryDirection" NOT NULL,
    "note"            TEXT,
    "createdBy"       TEXT         NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "voidedAt"        TIMESTAMP(3),
    "voidedBy"        TEXT,
    "voidReason"      TEXT,
    "idempotencyKey"  TEXT,
    "ledgerJournalId" TEXT,

    CONSTRAINT "cash_entries_pkey" PRIMARY KEY ("id")
);

-- cash_entry_events table

CREATE TABLE "cash_entry_events" (
    "id"          TEXT                 NOT NULL,
    "cashEntryId" TEXT                 NOT NULL,
    "eventType"   "CashEntryEventType" NOT NULL,
    "actorId"     TEXT                 NOT NULL,
    "changes"     JSONB,
    "reason"      TEXT,
    "createdAt"   TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_entry_events_pkey" PRIMARY KEY ("id")
);

-- Foreign keys

ALTER TABLE "cash_entries"
    ADD CONSTRAINT "cash_entries_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cash_entry_events"
    ADD CONSTRAINT "cash_entry_events_cashEntryId_fkey"
    FOREIGN KEY ("cashEntryId") REFERENCES "cash_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint

CREATE UNIQUE INDEX "cash_entries_businessId_idempotencyKey_key"
    ON "cash_entries"("businessId", "idempotencyKey");

-- Indexes

CREATE INDEX "cash_entries_businessId_createdAt_idx"
    ON "cash_entries"("businessId", "createdAt" DESC);

CREATE INDEX "cash_entries_businessId_voidedAt_idx"
    ON "cash_entries"("businessId", "voidedAt");

CREATE INDEX "cash_entries_businessId_direction_createdAt_idx"
    ON "cash_entries"("businessId", "direction", "createdAt" DESC);

CREATE INDEX "cash_entry_events_cashEntryId_createdAt_idx"
    ON "cash_entry_events"("cashEntryId", "createdAt");
