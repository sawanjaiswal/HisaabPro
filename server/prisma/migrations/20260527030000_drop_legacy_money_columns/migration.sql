-- Money-SSOT PR3: drop legacy Decimal/Float twins. Paise columns are SSOT.
-- Pre-flight: scripts/verify-money-paise-drift.sql must return zero rows.
-- This migration is destructive — rollback requires restore from backup.
--
-- Lock budget: each ALTER takes an ACCESS EXCLUSIVE lock on its table for
-- the duration of the catalog rewrite (metadata-only; no row scan on
-- modern PG). Set lock_timeout so a long-running reader can't pin us.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "User"
  DROP COLUMN "referralBalance",
  DROP COLUMN "referralBalanceInReview",
  DROP COLUMN "referralTotalEarned";

ALTER TABLE "ReferralCode" DROP COLUMN "totalEarned";

ALTER TABLE "ReferralReward" DROP COLUMN "amount";

ALTER TABLE "ReferralWithdrawal" DROP COLUMN "amount";

ALTER TABLE "PaymentDiscount" DROP COLUMN "value";
