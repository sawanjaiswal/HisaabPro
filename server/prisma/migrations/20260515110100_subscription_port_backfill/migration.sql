-- Step 2: Backfill subscriptionState, autoRenew, paymentMethod from existing columns.
-- Migration: subscription_port_backfill
-- Part of: subscription-port mission, Gate 1.
-- Down: UPDATE "Subscription" SET "subscriptionState" = NULL, "autoRenew" = NULL, "paymentMethod" = NULL;

-- Backfill subscriptionState from legacy status column
UPDATE "Subscription"
SET "subscriptionState" = CASE
  WHEN "status" = 'ACTIVE'    AND "expiresAt" > NOW() THEN 'ACTIVE'
  WHEN "status" = 'ACTIVE'    AND "expiresAt" IS NULL  THEN 'ACTIVE'
  WHEN "status" = 'CANCELLED'                          THEN 'CANCELLED'
  WHEN "status" = 'PAST_DUE'                           THEN 'PAST_DUE'
  WHEN "status" = 'TRIALING'                           THEN 'TRIAL_NO_AUTOPAY'
  ELSE 'NONE'
END
WHERE "subscriptionState" IS NULL;

-- Backfill autoRenew: paid+active subs auto-renew; free subs do not
UPDATE "Subscription"
SET "autoRenew" = (("planTier" <> 'FREE') AND ("status" = 'ACTIVE'))
WHERE "autoRenew" IS NULL;

-- Backfill paymentMethod: MANUAL for non-Razorpay, RAZORPAY for those with razorpaySubId
UPDATE "Subscription"
SET "paymentMethod" = 'MANUAL'
WHERE "paymentMethod" IS NULL AND "razorpaySubId" IS NULL;

UPDATE "Subscription"
SET "paymentMethod" = 'RAZORPAY'
WHERE "paymentMethod" IS NULL AND "razorpaySubId" IS NOT NULL;
