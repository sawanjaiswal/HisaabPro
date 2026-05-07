-- expenses_status_backfill: PR2 — set status on all existing Expense rows.
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507201000_expenses_status_backfill
--
-- Step 1: All existing expenses are confirmed by definition — set status=CONFIRMED.
-- Step 2: For isRecurring=true rows, create an ExpenseTemplate and back-link templateId.
--         Uses gen_random_uuid() (pgcrypto; available in PG 13+ core via pgcrypto or
--         gen_random_uuid() built-in PG 13+). Falls back to uuid_generate_v4() if preferred.
-- Both steps are idempotent (WHERE status IS NULL / WHERE templateId IS NULL).

-- ─── Step 1: Backfill status = 'CONFIRMED' on all non-deleted rows ───────────

UPDATE "Expense"
SET    "status" = 'CONFIRMED'::"ExpenseStatus"
WHERE  "status" IS NULL;

-- ─── Step 2: Create ExpenseTemplate rows for isRecurring=true expenses ────────
-- Insert one template per unique (businessId, categoryId, paymentMode, createdBy)
-- combination found in isRecurring=true expenses that do not yet have a templateId.
-- We use the most recent such expense as the source row for amount/note.
--
-- nextRunDate = first day of next month at 00:00 UTC (sensible default for MONTHLY).

INSERT INTO "ExpenseTemplate" (
  "id",
  "businessId",
  "categoryId",
  "amountPaise",
  "frequency",
  "nextRunDate",
  "paymentMode",
  "note",
  "createdBy",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::TEXT                                 AS "id",
  e."businessId",
  e."categoryId",
  e."amount"                                              AS "amountPaise",
  'MONTHLY'::"ExpenseFrequency"                           AS "frequency",
  date_trunc('month', NOW() + INTERVAL '1 month')         AS "nextRunDate",
  e."paymentMode",
  e."notes"                                               AS "note",
  e."createdBy",
  NOW()                                                   AS "createdAt",
  NOW()                                                   AS "updatedAt"
FROM (
  -- Pick the most-recent expense per (businessId, categoryId, paymentMode, createdBy)
  SELECT DISTINCT ON ("businessId", "categoryId", "paymentMode", "createdBy")
    "id", "businessId", "categoryId", "amount", "paymentMode", "notes", "createdBy"
  FROM  "Expense"
  WHERE "isRecurring" = true
    AND "isDeleted"   = false
    AND "templateId"  IS NULL
  ORDER BY "businessId", "categoryId", "paymentMode", "createdBy", "createdAt" DESC
) e;

-- ─── Step 3: Back-link Expense.templateId to the newly created template ───────
-- Match on same (businessId, categoryId, paymentMode, createdBy).

UPDATE "Expense" e
SET    "templateId" = t."id"
FROM   "ExpenseTemplate" t
WHERE  e."isRecurring" = true
  AND  e."templateId"  IS NULL
  AND  e."isDeleted"   = false
  AND  t."businessId"  = e."businessId"
  AND  t."categoryId"  = e."categoryId"
  AND  t."paymentMode" = e."paymentMode"
  AND  t."createdBy"   = e."createdBy";
