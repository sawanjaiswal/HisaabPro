-- expenses_status_not_null: PR2 finalisation — enforce NOT NULL on Expense.status.
-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260507202000_expenses_status_not_null
--
-- Precondition: 20260507201000_expenses_status_backfill has been applied.
--               SELECT COUNT(*) FROM "Expense" WHERE status IS NULL  →  0
-- If that precondition is not met, this migration will fail with:
--   ERROR: column "status" contains null values
-- which is the correct, safe failure mode.

ALTER TABLE "Expense" ALTER COLUMN "status" SET NOT NULL;
