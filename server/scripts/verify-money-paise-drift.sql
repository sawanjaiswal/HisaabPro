-- Money-SSOT PR2 ship gate: assert paise columns mirror legacy Decimal/Float.
--
-- Run on prod (read-only) after backfill + 24h soak. Must return zero rows.
-- A non-zero row reveals a service write site that updated the legacy column
-- without writing the paise twin — investigate before PR3 ships.

SELECT 'User' AS tbl, 'referralBalance' AS col, COUNT(*) AS drift FROM "User"
  WHERE "referralBalancePaise" IS NULL
     OR "referralBalancePaise" <> ROUND("referralBalance" * 100)::int
UNION ALL SELECT 'User','referralBalanceInReview', COUNT(*) FROM "User"
  WHERE "referralBalanceInReviewPaise" IS NULL
     OR "referralBalanceInReviewPaise" <> ROUND("referralBalanceInReview" * 100)::int
UNION ALL SELECT 'User','referralTotalEarned', COUNT(*) FROM "User"
  WHERE "referralTotalEarnedPaise" IS NULL
     OR "referralTotalEarnedPaise" <> ROUND("referralTotalEarned" * 100)::bigint
UNION ALL SELECT 'ReferralCode','totalEarned', COUNT(*) FROM "ReferralCode"
  WHERE "totalEarnedPaise" IS NULL
     OR "totalEarnedPaise" <> ROUND("totalEarned" * 100)::bigint
UNION ALL SELECT 'ReferralReward','amount', COUNT(*) FROM "ReferralReward"
  WHERE "amountPaise" IS NULL
     OR "amountPaise" <> ROUND("amount" * 100)::int
UNION ALL SELECT 'ReferralWithdrawal','amount', COUNT(*) FROM "ReferralWithdrawal"
  WHERE "amountPaise" IS NULL
     OR "amountPaise" <> ROUND("amount" * 100)::int
UNION ALL SELECT 'PaymentDiscount','value', COUNT(*) FROM "PaymentDiscount"
  WHERE ("valuePaise" IS NULL AND "percentBps" IS NULL)
     OR (type = 'FIXED'      AND ("valuePaise" IS NULL OR "valuePaise" <> ROUND("value")::int))
     OR (type = 'PERCENTAGE' AND ("percentBps" IS NULL OR "percentBps" <> ROUND("value" * 100)::int))
ORDER BY tbl, col;
