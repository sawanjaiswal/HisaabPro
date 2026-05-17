/**
 * Loyalty #125 — Accrual service. Called INSIDE the POS $transaction.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.1 (accrual rules),
 * §11.6-11.8 (analytics), §3.4.1 (void/restore symmetry contract).
 *
 * Rules:
 *  - Walk-in (partyId === null OR sentinel OR party.isWalkIn=true) → skip.
 *    Architecture §11.6: emit `loyalty_accrued` with skipped=true.
 *  - Program disabled → skip silently.
 *  - Subtotal < accrualMinSpendPaise → skip silently.
 *  - Points = floor(subtotalPaise × accrualRateBps / 10000) via BigInt
 *    cross-multiply (see loyalty.utils.computePointsEarned).
 *  - expiresAt = now + expiryMonths * 30d when expiryMonths is set; else null.
 *  - Writes 1 AC row inside the caller's `tx`. NOT idempotent — callers MUST
 *    prevent retry by gating on PosSale creation success (this service runs
 *    AFTER PosSale insert in step 10.6).
 *
 * The accrual service does NOT throw on "skip" conditions — they are normal
 * happy-path outcomes (walk-in, disabled, below-min). Only DB/programmer
 * errors propagate.
 */

import type { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { computePointsEarned } from './loyalty.utils.js'
import { WALK_IN_PARTY_SENTINEL } from './loyalty.constants.js'

// ─── Tx client type ─────────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// ─── Input ──────────────────────────────────────────────────────────────────

export interface AccrueForSaleInput {
  businessId: string
  partyId: string | null
  posSaleId: string
  subtotalPaise: number
  saleDate: Date
}

export interface AccrueResult {
  skipped: boolean
  reason?: 'walk_in' | 'program_disabled' | 'below_min_spend' | 'zero_points'
  ledgerId?: string
  pointsEarned: number
  expiresAt: Date | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeExpiresAt(saleDate: Date, expiryMonths: number | null): Date | null {
  if (expiryMonths === null || expiryMonths === undefined) return null
  // Architecture §2.1: expiry uses 30-day months (calendar-month-of-record drift
  // is acceptable for SMB scale; FY closure does not snap to month boundaries).
  const ms = expiryMonths * 30 * 24 * 3600 * 1000
  return new Date(saleDate.getTime() + ms)
}

async function loadProgram(
  tx: TxClient,
  businessId: string
): Promise<{
  enabled: boolean
  accrualRateBps: number
  accrualMinSpendPaise: number
  expiryMonths: number | null
} | null> {
  const row = await tx.loyaltyProgram.findUnique({
    where: { businessId },
    select: {
      enabled: true,
      accrualRateBps: true,
      accrualMinSpendPaise: true,
      expiryMonths: true,
    },
  })
  return row
}

async function isWalkInRealParty(tx: TxClient, partyId: string): Promise<boolean> {
  // Walk-in party rows carry a sentinel name + nullable phone. PR1/Architecture
  // §3.1 specifies the sentinel-id ("walkin") path; production also creates
  // per-business walk-in rows. Caller passes the resolved id — we just compare.
  if (partyId === WALK_IN_PARTY_SENTINEL) return true
  const party = await tx.party.findUnique({
    where: { id: partyId },
    select: { name: true, phone: true },
  })
  // Convention from getOrCreateWalkInParty (pos-checkout.walkin.ts): name === 'Walk-in'
  if (!party) return false
  return party.name === 'Walk-in' && (party.phone === null || party.phone === '')
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Write an AC ledger row for the given PosSale. MUST be invoked inside the
 * POS checkout `$transaction` so accrual rolls back if anything later throws.
 *
 * Returns a result object describing what happened — callers may use this for
 * audit-event payloads + post-commit analyticsEmit.
 */
export async function accrueForSale(
  tx: TxClient,
  input: AccrueForSaleInput
): Promise<AccrueResult> {
  const { businessId, partyId, posSaleId, subtotalPaise, saleDate } = input

  // 1. Walk-in skip (architecture §3.1)
  if (!partyId || partyId === WALK_IN_PARTY_SENTINEL) {
    return { skipped: true, reason: 'walk_in', pointsEarned: 0, expiresAt: null }
  }
  if (await isWalkInRealParty(tx, partyId)) {
    return { skipped: true, reason: 'walk_in', pointsEarned: 0, expiresAt: null }
  }

  // 2. Program guard
  const program = await loadProgram(tx, businessId)
  if (!program || !program.enabled) {
    return { skipped: true, reason: 'program_disabled', pointsEarned: 0, expiresAt: null }
  }

  // 3. Min-spend guard
  if (subtotalPaise < program.accrualMinSpendPaise) {
    return { skipped: true, reason: 'below_min_spend', pointsEarned: 0, expiresAt: null }
  }

  // 4. Compute points (BigInt cross-mult — never overflows)
  const points = computePointsEarned(subtotalPaise, program.accrualRateBps)
  if (points <= 0) {
    return { skipped: true, reason: 'zero_points', pointsEarned: 0, expiresAt: null }
  }

  // 5. Write AC row
  const expiresAt = computeExpiresAt(saleDate, program.expiryMonths)
  const row = await tx.loyaltyLedger.create({
    data: {
      businessId,
      partyId,
      type: 'AC',
      delta: points,
      posSaleId,
      earnedAt: saleDate,
      expiresAt,
      note: `Accrual for POS ${posSaleId.slice(0, 8)}`,
    } satisfies Prisma.LoyaltyLedgerUncheckedCreateInput,
    select: { id: true },
  })

  return {
    skipped: false,
    pointsEarned: points,
    expiresAt,
    ledgerId: row.id,
  }
}
