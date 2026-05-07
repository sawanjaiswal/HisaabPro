-- expenses_upgrade_init: additive schema — PR1 (no backfill; PR2 handles that).
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507200000_expenses_upgrade_init
--
-- Adds: ExpenseStatus enum, ExpenseFrequency enum, nullable columns on Expense,
--       ExpenseTemplate table, ExpenseBudget table.
-- Zero data loss: all new Expense columns are nullable; existing rows unchanged.

-- 1. Enums
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'SKIPPED', 'VOIDED');
CREATE TYPE "ExpenseFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- 2. New nullable columns on Expense (all nullable in PR1; NOT NULL enforced after PR2 backfill)
ALTER TABLE "Expense"
  ADD COLUMN "status"        "ExpenseStatus",
  ADD COLUMN "templateId"    TEXT,
  ADD COLUMN "confirmedAt"   TIMESTAMP(3),
  ADD COLUMN "skippedAt"     TIMESTAMP(3),
  ADD COLUMN "ocrSourceHash" VARCHAR(64);

-- 3. ExpenseTemplate table
CREATE TABLE "ExpenseTemplate" (
  "id"          TEXT        NOT NULL,
  "businessId"  TEXT        NOT NULL,
  "categoryId"  TEXT        NOT NULL,
  "amountPaise" INTEGER     NOT NULL,
  "frequency"   "ExpenseFrequency" NOT NULL,
  "dayOfMonth"  INTEGER,
  "dayOfWeek"   INTEGER,
  "nextRunDate" TIMESTAMP(3) NOT NULL,
  "lastRunDate" TIMESTAMP(3),
  "paymentMode" TEXT        NOT NULL,
  "partyId"     TEXT,
  "note"        TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "isDeleted"   BOOLEAN     NOT NULL DEFAULT false,
  "deletedAt"   TIMESTAMP(3),
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseTemplate_pkey" PRIMARY KEY ("id")
);

-- 4. ExpenseBudget table
CREATE TABLE "ExpenseBudget" (
  "id"          TEXT        NOT NULL,
  "businessId"  TEXT        NOT NULL,
  "categoryId"  TEXT,
  "monthYmd"    VARCHAR(10) NOT NULL,
  "amountPaise" INTEGER     NOT NULL,
  "isDeleted"   BOOLEAN     NOT NULL DEFAULT false,
  "deletedAt"   TIMESTAMP(3),
  "createdBy"   TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseBudget_pkey" PRIMARY KEY ("id")
);

-- 5. Indexes
CREATE INDEX "Expense_businessId_status_isDeleted_idx"
  ON "Expense" ("businessId", "status", "isDeleted");

CREATE INDEX "Expense_businessId_templateId_idx"
  ON "Expense" ("businessId", "templateId");

CREATE INDEX "ExpenseTemplate_businessId_isActive_nextRunDate_idx"
  ON "ExpenseTemplate" ("businessId", "isActive", "nextRunDate");

CREATE INDEX "ExpenseTemplate_businessId_categoryId_idx"
  ON "ExpenseTemplate" ("businessId", "categoryId");

CREATE UNIQUE INDEX "ExpenseBudget_businessId_categoryId_monthYmd_key"
  ON "ExpenseBudget" ("businessId", "categoryId", "monthYmd");

CREATE INDEX "ExpenseBudget_businessId_monthYmd_idx"
  ON "ExpenseBudget" ("businessId", "monthYmd");

-- 6. Foreign keys
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ExpenseTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExpenseTemplate"
  ADD CONSTRAINT "ExpenseTemplate_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseTemplate"
  ADD CONSTRAINT "ExpenseTemplate_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpenseTemplate"
  ADD CONSTRAINT "ExpenseTemplate_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpenseBudget"
  ADD CONSTRAINT "ExpenseBudget_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseBudget"
  ADD CONSTRAINT "ExpenseBudget_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpenseBudget"
  ADD CONSTRAINT "ExpenseBudget_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
