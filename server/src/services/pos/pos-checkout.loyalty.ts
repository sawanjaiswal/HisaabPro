/**
 * POS Checkout — Loyalty splice helpers (called from pos-checkout.service.ts
 * inside the existing $transaction at steps 10.5 + 10.6).
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.1.
 * Extracted from pos-checkout.service.ts to keep that orchestrator ≤ 250 LOC.
 *
 * Contract: these helpers MUST be invoked inside the POS $transaction so
 * loyalty ledger rows and PosSale rollback together if anything throws after
 * insert.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { CreatePosSaleInput } from './pos.validators.js'
import { applyRedemption } from '../loyalty/loyalty-redeem.service.js'
import {
  accrueForSale,
  type AccrueResult,
} from '../loyalty/loyalty-accrual.service.js'
import { analyticsEmit } from '../../lib/analytics.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface LoyaltyCheckoutOutcome {
  totalPointsRedeemed: number
  totalDiscountRedeemed: number
  accrual: AccrueResult
}

export interface ApplyCheckoutLoyaltyArgs {
  businessId: string
  posSaleId: string
  partyId: string
  input: CreatePosSaleInput
  subtotal: number
  saleDate: Date
}

/**
 * Run loyalty steps 10.5 (redemption) + 10.6 (accrual) of POS checkout.
 *
 * - Redemption: iterates all `loyalty_redemption` payment entries; throws on
 *   insufficient balance / concurrent-redemption lock failure.
 * - Accrual: always called (walk-in / disabled / below-min are silent skips
 *   handled inside accrueForSale).
 *
 * NOTE: the caller is responsible for emitting post-commit analytics — we
 * return outcome data so the orchestrator can `analyticsEmit` after the
 * `$transaction` Promise resolves.
 */
export async function applyCheckoutLoyalty(
  tx: TxClient,
  args: ApplyCheckoutLoyaltyArgs
): Promise<LoyaltyCheckoutOutcome> {
  const { businessId, posSaleId, partyId, input, subtotal, saleDate } = args

  // ── 10.5 Redemption ──────────────────────────────────────────────────
  const loyaltyPayments = input.payments.filter(p => p.mode === 'loyalty_redemption')
  let totalPointsRedeemed = 0
  let totalDiscountRedeemed = 0
  for (const p of loyaltyPayments) {
    const result = await applyRedemption(tx, {
      businessId,
      partyId,
      posSaleId,
      pointsRedeemed: p.pointsRedeemed ?? 0,
      discountPaise: p.amountPaise,
    })
    totalPointsRedeemed += result.pointsRedeemed
    totalDiscountRedeemed += result.discountPaise
  }

  // ── 10.6 Accrual ─────────────────────────────────────────────────────
  const accrual = await accrueForSale(tx, {
    businessId,
    partyId: input.partyId ?? null,
    posSaleId,
    subtotalPaise: subtotal,
    saleDate,
  })

  return { totalPointsRedeemed, totalDiscountRedeemed, accrual }
}

// ─── Post-commit telemetry ─────────────────────────────────────────────────

/**
 * Emit post-commit analytics for the loyalty steps. Called from the POS
 * checkout orchestrator AFTER `$transaction` resolves (architecture §3.8 —
 * side effects happen post-commit so a rolled-back tx never emits).
 */
export function emitCheckoutLoyaltyAnalytics(
  outcome: LoyaltyCheckoutOutcome,
  ctx: { businessId: string; posSaleId: string; partyId: string }
): void {
  if (outcome.totalPointsRedeemed > 0) {
    analyticsEmit('loyalty_redeemed', {
      businessId: ctx.businessId,
      partyId: ctx.partyId,
      posSaleId: ctx.posSaleId,
      pointsRedeemed: outcome.totalPointsRedeemed,
      discountPaise: outcome.totalDiscountRedeemed,
    })
  }
  const a = outcome.accrual
  analyticsEmit('loyalty_accrued', a.skipped
    ? { businessId: ctx.businessId, posSaleId: ctx.posSaleId, skipped: true, reason: a.reason }
    : {
        businessId: ctx.businessId,
        partyId: ctx.partyId,
        posSaleId: ctx.posSaleId,
        pointsEarned: a.pointsEarned,
        expiresAt: a.expiresAt?.toISOString() ?? null,
      })
}
