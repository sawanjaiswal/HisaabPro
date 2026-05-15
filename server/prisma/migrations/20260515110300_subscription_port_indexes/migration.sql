-- Step 4: Add indexes on new Subscription columns for cron + gate queries.
-- Migration: subscription_port_indexes
-- Part of: subscription-port mission, Gate 1.
-- Down: DROP INDEX IF EXISTS "Subscription_subscriptionState_idx";
--       DROP INDEX IF EXISTS "Subscription_nextBillingAt_idx";
--       DROP INDEX IF EXISTS "Subscription_gracePeriodEndsAt_idx";

-- Index for cron + gate queries by subscriptionState
CREATE INDEX IF NOT EXISTS "Subscription_subscriptionState_idx"
  ON "Subscription"("subscriptionState");

-- Index for cron renewal scan (find subs due for charge)
CREATE INDEX IF NOT EXISTS "Subscription_nextBillingAt_idx"
  ON "Subscription"("nextBillingAt");

-- Index for overflow cron (find subs with expired grace)
CREATE INDEX IF NOT EXISTS "Subscription_gracePeriodEndsAt_idx"
  ON "Subscription"("gracePeriodEndsAt");
