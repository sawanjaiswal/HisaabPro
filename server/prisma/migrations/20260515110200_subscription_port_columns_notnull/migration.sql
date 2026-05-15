-- Step 3: Tighten backfilled columns to NOT NULL with defaults.
-- Migration: subscription_port_columns_notnull
-- Part of: subscription-port mission, Gate 1.
-- Pre-condition: Step 2 backfill MUST have run — no NULLs remain in these columns.
-- Down: ALTER TABLE "Subscription" ALTER COLUMN "subscriptionState" DROP NOT NULL;
--       ALTER TABLE "Subscription" ALTER COLUMN "autoRenew" DROP NOT NULL;
--       ALTER TABLE "Subscription" ALTER COLUMN "paymentMethod" DROP NOT NULL;

-- Set NOT NULL + DEFAULT on subscriptionState
ALTER TABLE "Subscription"
  ALTER COLUMN "subscriptionState" SET NOT NULL,
  ALTER COLUMN "subscriptionState" SET DEFAULT 'NONE';

-- Set NOT NULL + DEFAULT on autoRenew
ALTER TABLE "Subscription"
  ALTER COLUMN "autoRenew" SET NOT NULL,
  ALTER COLUMN "autoRenew" SET DEFAULT false;

-- Set NOT NULL + DEFAULT on paymentMethod
ALTER TABLE "Subscription"
  ALTER COLUMN "paymentMethod" SET NOT NULL,
  ALTER COLUMN "paymentMethod" SET DEFAULT 'MANUAL';
