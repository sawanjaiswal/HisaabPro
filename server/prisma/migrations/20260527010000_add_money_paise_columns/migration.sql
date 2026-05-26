-- Money-SSOT Phase 1: Additive paise columns.
--
-- NULL-first add. The backfill script populates these; a follow-up migration
-- (set_money_paise_not_null) flips them to NOT NULL after drift is verified.
-- Fail fast on lock contention so a contended DDL doesn't stall the live API.

SET lock_timeout = '3s';
SET statement_timeout = '10s';

ALTER TABLE "User"
  ADD COLUMN "referralBalancePaise"         INTEGER,
  ADD COLUMN "referralBalanceInReviewPaise" INTEGER,
  ADD COLUMN "referralTotalEarnedPaise"     BIGINT;

ALTER TABLE "ReferralCode"
  ADD COLUMN "totalEarnedPaise" BIGINT;

ALTER TABLE "ReferralReward"
  ADD COLUMN "amountPaise" INTEGER;

ALTER TABLE "ReferralWithdrawal"
  ADD COLUMN "amountPaise" INTEGER;

ALTER TABLE "PaymentDiscount"
  ADD COLUMN "valuePaise" INTEGER,
  ADD COLUMN "percentBps" INTEGER;
