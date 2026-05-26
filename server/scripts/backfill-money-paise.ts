/**
 * Money-SSOT backfill — Decimal/Float rupees → Int/BigInt paise.
 *
 * Idempotent: WHERE paise column IS NULL. Re-running yields 0 row updates.
 *
 * Run sequence:
 *   1. PR1 migration `add_money_paise_columns` deployed.
 *   2. This script run (against prod, one-shot).
 *   3. PR2 migration `set_money_paise_not_null` deployed.
 *
 * Pre-flight: aborts if any row would overflow INT32 on an INT-typed target.
 * Lifetime columns (User.referralTotalEarnedPaise, ReferralCode.totalEarnedPaise)
 * are BIGINT — no overflow check needed.
 *
 * Verifier: after backfill, prints drift count per (table, column). Operator
 * must see "drift: 0" across the board before PR3 ships.
 */

import { prisma } from '../src/lib/prisma.js'

const INT32_MAX = 2_147_483_647n

interface MaxRow { tbl: string; col: string; max_paise: bigint | null }

async function preflight() {
  const rows = await prisma.$queryRaw<MaxRow[]>`
    SELECT 'User'                as tbl, 'referralBalance'         as col, COALESCE(MAX(ROUND("referralBalance"         * 100)::bigint), 0::bigint) as max_paise FROM "User"
    UNION ALL SELECT 'User',                 'referralBalanceInReview', COALESCE(MAX(ROUND("referralBalanceInReview" * 100)::bigint), 0::bigint) FROM "User"
    UNION ALL SELECT 'ReferralReward',       'amount',                  COALESCE(MAX(ROUND("amount"                   * 100)::bigint), 0::bigint) FROM "ReferralReward"
    UNION ALL SELECT 'ReferralWithdrawal',   'amount',                  COALESCE(MAX(ROUND("amount"                   * 100)::bigint), 0::bigint) FROM "ReferralWithdrawal"
  `
  for (const r of rows) {
    const max = r.max_paise ?? 0n
    if (max > INT32_MAX) {
      throw new Error(
        `${r.tbl}.${r.col}: max ${max} paise > INT32_MAX (${INT32_MAX}). ` +
          `Promote target column to BIGINT before backfilling.`
      )
    }
    console.log(`pre-flight OK: ${r.tbl}.${r.col} max=${max} paise`)
  }
}

async function backfill() {
  // User wallet — backfill ALL rows (including zero-balance) so subsequent
  // Prisma `{ increment: X }` calls on the paise columns don't NULL-out.
  const userRows = await prisma.$executeRaw`
    UPDATE "User"
    SET "referralBalancePaise"          = ROUND("referralBalance"         * 100)::int,
        "referralBalanceInReviewPaise" = ROUND("referralBalanceInReview" * 100)::int,
        "referralTotalEarnedPaise"     = ROUND("referralTotalEarned"     * 100)::bigint
    WHERE "referralBalancePaise" IS NULL
       OR "referralBalanceInReviewPaise" IS NULL
       OR "referralTotalEarnedPaise" IS NULL
  `
  console.log(`User: ${userRows} rows`)

  const codeRows = await prisma.$executeRaw`
    UPDATE "ReferralCode"
    SET "totalEarnedPaise" = ROUND("totalEarned" * 100)::bigint
    WHERE "totalEarnedPaise" IS NULL
  `
  console.log(`ReferralCode: ${codeRows} rows`)

  const rewardRows = await prisma.$executeRaw`
    UPDATE "ReferralReward"
    SET "amountPaise" = ROUND("amount" * 100)::int
    WHERE "amountPaise" IS NULL
  `
  console.log(`ReferralReward: ${rewardRows} rows`)

  const wdRows = await prisma.$executeRaw`
    UPDATE "ReferralWithdrawal"
    SET "amountPaise" = ROUND("amount" * 100)::int
    WHERE "amountPaise" IS NULL
  `
  console.log(`ReferralWithdrawal: ${wdRows} rows`)

  // PaymentDiscount — split via type discriminator. type=FIXED has value in
  // paise already (per legacy comment); type=PERCENTAGE has percent value
  // (× 100 → bps).
  const fixedRows = await prisma.$executeRaw`
    UPDATE "PaymentDiscount"
    SET "valuePaise" = ROUND("value")::int
    WHERE "valuePaise" IS NULL AND "percentBps" IS NULL AND type = 'FIXED'
  `
  const percentRows = await prisma.$executeRaw`
    UPDATE "PaymentDiscount"
    SET "percentBps" = ROUND("value" * 100)::int
    WHERE "valuePaise" IS NULL AND "percentBps" IS NULL AND type = 'PERCENTAGE'
  `
  console.log(`PaymentDiscount: FIXED=${fixedRows} PERCENTAGE=${percentRows}`)
}

interface DriftRow { tbl: string; col: string; drift: bigint }

async function verifyNoDrift() {
  const rows = await prisma.$queryRaw<DriftRow[]>`
    SELECT 'User' as tbl, 'referralBalance' as col, COUNT(*)::bigint as drift
      FROM "User"
      WHERE "referralBalancePaise" IS NULL
         OR "referralBalancePaise" <> ROUND("referralBalance" * 100)::int
    UNION ALL SELECT 'User','referralBalanceInReview', COUNT(*)::bigint FROM "User"
      WHERE "referralBalanceInReviewPaise" IS NULL
         OR "referralBalanceInReviewPaise" <> ROUND("referralBalanceInReview" * 100)::int
    UNION ALL SELECT 'User','referralTotalEarned', COUNT(*)::bigint FROM "User"
      WHERE "referralTotalEarnedPaise" IS NULL
         OR "referralTotalEarnedPaise" <> ROUND("referralTotalEarned" * 100)::bigint
    UNION ALL SELECT 'ReferralCode','totalEarned', COUNT(*)::bigint FROM "ReferralCode"
      WHERE "totalEarnedPaise" IS NULL
         OR "totalEarnedPaise" <> ROUND("totalEarned" * 100)::bigint
    UNION ALL SELECT 'ReferralReward','amount', COUNT(*)::bigint FROM "ReferralReward"
      WHERE "amountPaise" IS NULL
         OR "amountPaise" <> ROUND("amount" * 100)::int
    UNION ALL SELECT 'ReferralWithdrawal','amount', COUNT(*)::bigint FROM "ReferralWithdrawal"
      WHERE "amountPaise" IS NULL
         OR "amountPaise" <> ROUND("amount" * 100)::int
    UNION ALL SELECT 'PaymentDiscount','value', COUNT(*)::bigint FROM "PaymentDiscount"
      WHERE ("valuePaise" IS NULL AND "percentBps" IS NULL)
         OR (type = 'FIXED'      AND ("valuePaise" IS NULL OR "valuePaise" <> ROUND("value")::int))
         OR (type = 'PERCENTAGE' AND ("percentBps" IS NULL OR "percentBps" <> ROUND("value" * 100)::int))
  `
  let total = 0n
  for (const r of rows) {
    const drift = r.drift ?? 0n
    total += drift
    const status = drift === 0n ? 'OK' : 'DRIFT'
    console.log(`${status}: ${r.tbl}.${r.col} drift=${drift}`)
  }
  if (total > 0n) {
    throw new Error(`Drift detected: ${total} rows across all columns. Investigate before proceeding to PR3.`)
  }
  console.log('All columns: drift=0')
}

async function main() {
  console.log('=== Pre-flight overflow check ===')
  await preflight()
  console.log('\n=== Backfill ===')
  await backfill()
  console.log('\n=== Drift verifier ===')
  await verifyNoDrift()
  console.log('\nBackfill complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
