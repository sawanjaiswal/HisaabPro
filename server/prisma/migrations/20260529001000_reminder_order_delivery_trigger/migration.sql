-- Add ORDER_DELIVERY value to ReminderRuleTrigger enum.
-- Append-only, irreversible (Postgres cannot DROP an enum value without a type
-- rebuild). Safe: no existing rows reference it.
ALTER TYPE "ReminderRuleTrigger" ADD VALUE IF NOT EXISTS 'ORDER_DELIVERY';
