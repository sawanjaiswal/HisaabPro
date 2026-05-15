-- Step 1: Add new columns to Subscription table — all NULLABLE so existing rows survive.
-- Migration: subscription_port_columns_nullable
-- Part of: subscription-port mission, Gate 1.
-- Down: ALTER TABLE "Subscription" DROP COLUMN IF EXISTS each column listed below.

-- AlterTable
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "subscriptionState"       TEXT,
  ADD COLUMN IF NOT EXISTS "mandateId"               TEXT,
  ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoRenew"               BOOLEAN,
  ADD COLUMN IF NOT EXISTS "nextBillingAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentMethod"           TEXT,
  ADD COLUMN IF NOT EXISTS "lastEntitlementIssuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingDowngradeTier"    TEXT,
  ADD COLUMN IF NOT EXISTS "overflowGraceUntil"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastWebhookEventId"      TEXT;
