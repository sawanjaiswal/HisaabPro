/**
 * Loyalty #125 — Redemption service. Called INSIDE the POS $transaction.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.2 (FIFO oldest-AC),
 * §2.6 (advisory lock), §11.7 (analytics).
 *
 * Contract:
 *  - Caller is the POS checkout path (step 10.5). All input has been
 *    pre-validated at the route — partyId is tenant-checked (NEW_S2), points
 *    × redeemRateBps math is BigInt-exact (S1), payment.amountPaise mirrors
 *    the points value.
 *  - We DO NOT spend AC rows individually (no FIFO tagging on AC rows) —
 *    we add ONE RD row whose delta is negative, scoped to the same partyId.
 *    Balance is a SUM over all unexpired rows, so FIFO is naturally honored:
 *    redemption first draws from oldest unexpired AC because that's where
 *    the unexpired delta sits.
 *  - To prevent two concurrent redemptions over-spending the same balance
 *    (race condition), we take a PostgreSQL transaction-scoped advisory
 *    lock keyed on a hash of the partyId. If the lock cannot be acquired
 *    immediately we throw 409 LOYALTY_CONCURRENT_REDEMPTION (NOT 500).
 *  - Balance precheck happens INSIDE the lock so concurrent redemptions
 *    can't both see "enough balance" and both write RD rows.
 *
 * The service does NOT validate the math (route layer did that). It only
 * checks BALANCE here — math validation is the validator's job (S1).
 */

import type { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import {
  loyaltyDisabledError,
  loyaltyInsufficientBalanceError,
} from './loyalty.errors.js'

// ─── Tx client type ─────────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ─── Input ──────────────────────────────────────────────────────────────────

export interface ApplyRedemptionInput {
  businessId: string
  partyId: string
  posSaleId: string
  pointsRedeemed: number
  discountPaise: number
}

export interface ApplyRedemptionResult {
  ledgerId: string
  pointsRedeemed: number
  discountPaise: number
  remainingPoints: number
}

// ─── Errors ────────────────────────────────────────────────────────────────

function concurrentRedemptionError(): AppError {
  return new AppError(
    ErrorCode.DUPLICATE_ENTRY,
    409,
    'Another redemption is in progress for this party — retry in a moment',
    { reason: 'LOYALTY_CONCURRENT_REDEMPTION' }
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Stable 31-bit signed int from partyId for pg_try_advisory_xact_lock.
 *
 * Postgres advisory locks take BIGINT, but using a 32-bit cuid-hash keeps the
 * keyspace small enough that collisions across distinct parties are unlikely
 * for a single business (we further key by businessId hash too).
 */
function hashId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h
}

async function tryAdvisoryLock(
  tx: TxClient,
  businessId: string,
  partyId: string
): Promise<boolean> {
  const k1 = hashId(businessId)
  const k2 = hashId(partyId)
  const rows = await tx.$queryRaw<{ ok: boolean }[]>`
    SELECT pg_try_advisory_xact_lock(${k1}::int, ${k2}::int) AS ok
  `
  return rows[0]?.ok === true
}

async function getCurrentBalance(
  tx: TxClient,
  businessId: string,
  partyId: string,
  now: Date
): Promise<number> {
  const agg = await tx.loyaltyLedger.aggregate({
    where: {
      businessId,
      partyId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { delta: true },
  })
  return Math.max(0, agg._sum.delta ?? 0)
}

async function programEnabled(tx: TxClient, businessId: string): Promise<boolean> {
  const row = await tx.loyaltyProgram.findUnique({
    where: { businessId },
    select: { enabled: true },
  })
  return row?.enabled === true
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Apply a redemption inside the POS $transaction. Writes 1 RD row with
 * negative delta. Throws on insufficient balance (400) or concurrent-
 * redemption lock failure (409).
 */
export async function applyRedemption(
  tx: TxClient,
  input: ApplyRedemptionInput
): Promise<ApplyRedemptionResult> {
  const { businessId, partyId, posSaleId, pointsRedeemed, discountPaise } = input

  if (pointsRedeemed <= 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Redemption points must be > 0',
      { reason: 'LOYALTY_REDEMPTION_INVALID' }
    )
  }

  // Program guard — disabled = reject hard at redemption time (vs accrual's
  // silent skip), so the cashier sees why the discount couldn't apply.
  if (!(await programEnabled(tx, businessId))) {
    throw loyaltyDisabledError()
  }

  // Advisory lock — serialize concurrent redemptions for THIS party.
  const locked = await tryAdvisoryLock(tx, businessId, partyId)
  if (!locked) throw concurrentRedemptionError()

  // Balance check INSIDE the lock so two concurrent redemptions cannot both
  // pass the precheck and both write RD rows.
  const now = new Date()
  const available = await getCurrentBalance(tx, businessId, partyId, now)
  if (available < pointsRedeemed) {
    throw loyaltyInsufficientBalanceError(available, pointsRedeemed)
  }

  // Write the RD row — FIFO is honored implicitly because aggregate-balance
  // already netted against the oldest unexpired AC entries first.
  const row = await tx.loyaltyLedger.create({
    data: {
      businessId,
      partyId,
      type: 'RD',
      delta: -pointsRedeemed,
      posSaleId,
      earnedAt: now,
      // RD rows have no expiry of their own — they offset AC rows.
      note: `Redeemed for POS ${posSaleId.slice(0, 8)} (-${discountPaise}p)`,
    } satisfies Prisma.LoyaltyLedgerUncheckedCreateInput,
    select: { id: true },
  })

  return {
    ledgerId: row.id,
    pointsRedeemed,
    discountPaise,
    remainingPoints: available - pointsRedeemed,
  }
}
