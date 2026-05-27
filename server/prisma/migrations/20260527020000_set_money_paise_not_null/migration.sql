-- Money-SSOT Phase 2: lock paise columns to NOT NULL with default 0.
--
-- Pre-condition (CI-gated): scripts/backfill-money-paise.ts has run on this DB
-- and the drift verifier reported 0 rows divergent across all columns.
--
-- SET DEFAULT and SET NOT NULL run as separate statements; the latter does a
-- full table scan (per Postgres docs) but blocks writers only briefly while
-- readers continue. lock_timeout fails fast on a contended ACCESS EXCLUSIVE
-- so the live API doesn't stall behind an analytics tx.

SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- Safety net: backfill from legacy Decimal if any rows are still NULL. In prod
-- the scripts/backfill-money-paise.ts pass already handled this; the UPDATE is
-- a no-op when the script has run. Without this, a User row inserted between
-- PR1 deploy and the backfill run would block SET NOT NULL.
UPDATE "User"
  SET "referralBalancePaise"         = COALESCE("referralBalancePaise",         ROUND("referralBalance"         * 100)::int),
      "referralBalanceInReviewPaise" = COALESCE("referralBalanceInReviewPaise", ROUND("referralBalanceInReview" * 100)::int),
      "referralTotalEarnedPaise"     = COALESCE("referralTotalEarnedPaise",     ROUND("referralTotalEarned"     * 100)::bigint)
  WHERE "referralBalancePaise" IS NULL
     OR "referralBalanceInReviewPaise" IS NULL
     OR "referralTotalEarnedPaise" IS NULL;

UPDATE "ReferralCode"
  SET "totalEarnedPaise" = COALESCE("totalEarnedPaise", ROUND("totalEarned" * 100)::bigint)
  WHERE "totalEarnedPaise" IS NULL;

UPDATE "ReferralReward"
  SET "amountPaise" = COALESCE("amountPaise", ROUND("amount" * 100)::int)
  WHERE "amountPaise" IS NULL;

UPDATE "ReferralWithdrawal"
  SET "amountPaise" = COALESCE("amountPaise", ROUND("amount" * 100)::int)
  WHERE "amountPaise" IS NULL;

UPDATE "PaymentDiscount"
  SET "valuePaise" = ROUND("value")::int
  WHERE "valuePaise" IS NULL AND "percentBps" IS NULL AND type = 'FIXED';
UPDATE "PaymentDiscount"
  SET "percentBps" = ROUND("value" * 100)::int
  WHERE "valuePaise" IS NULL AND "percentBps" IS NULL AND type = 'PERCENTAGE';

ALTER TABLE "User"
  ALTER COLUMN "referralBalancePaise"          SET DEFAULT 0,
  ALTER COLUMN "referralBalanceInReviewPaise" SET DEFAULT 0,
  ALTER COLUMN "referralTotalEarnedPaise"     SET DEFAULT 0;
ALTER TABLE "User"
  ALTER COLUMN "referralBalancePaise"          SET NOT NULL,
  ALTER COLUMN "referralBalanceInReviewPaise" SET NOT NULL,
  ALTER COLUMN "referralTotalEarnedPaise"     SET NOT NULL;

ALTER TABLE "ReferralCode"
  ALTER COLUMN "totalEarnedPaise" SET DEFAULT 0;
ALTER TABLE "ReferralCode"
  ALTER COLUMN "totalEarnedPaise" SET NOT NULL;

-- ReferralReward.amountPaise and ReferralWithdrawal.amountPaise: every row
-- written by the service has amountPaise populated (PR1 dual-write); legacy
-- rows have been backfilled. Lock NOT NULL.
ALTER TABLE "ReferralReward"
  ALTER COLUMN "amountPaise" SET NOT NULL;

ALTER TABLE "ReferralWithdrawal"
  ALTER COLUMN "amountPaise" SET NOT NULL;

-- PaymentDiscount: cannot be NOT NULL — exactly one of (valuePaise, percentBps)
-- is populated per row, dictated by `type`. Add a CHECK constraint that asserts
-- this invariant; PR3 will replace it with a discriminated-union shape on the
-- Zod side.
ALTER TABLE "PaymentDiscount"
  ADD CONSTRAINT payment_discount_value_xor CHECK (
    (type = 'FIXED'      AND "valuePaise" IS NOT NULL AND "percentBps" IS NULL) OR
    (type = 'PERCENTAGE' AND "percentBps" IS NOT NULL AND "valuePaise" IS NULL)
  );
