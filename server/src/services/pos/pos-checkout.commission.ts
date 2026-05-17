/**
 * POS Checkout — Commission splice helper (step 10.7).
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.1.
 *
 * Called from pos-checkout.service.ts INSIDE the existing $transaction
 * AFTER PR3's loyalty steps 10.5 (redeem) + 10.6 (accrue). Extracted to
 * keep the orchestrator ≤ 250 LOC and mirror the pos-checkout.loyalty.ts
 * pattern.
 *
 * Returns outcome data so the orchestrator can `analyticsEmit` AFTER
 * the `$transaction` Promise resolves (architecture §3.8 side-effect
 * rule — side effects fire post-commit so a rolled-back tx never emits).
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { accrueForPosSale } from '../commission/commission-accrual.service.js'
import { analyticsEmit } from '../../lib/analytics.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface CommissionCheckoutOutcome {
  rowsWritten: number
  totalCommissionPaise: number
}

export interface ApplyCheckoutCommissionArgs {
  businessId: string
  /** PosSale.cashierId — the staff who rang the sale (Locked Decision Q12). */
  staffUserId: string
  posSaleId: string
  saleDate: Date
}

/**
 * Step 10.7 — commission accrual on POS checkout. ALWAYS called (skip is
 * a normal happy-path outcome: zero rules / no matching rule / zero
 * commission → 0 rows written; not an error).
 */
export async function applyCheckoutCommission(
  tx: TxClient,
  args: ApplyCheckoutCommissionArgs
): Promise<CommissionCheckoutOutcome> {
  return accrueForPosSale(tx, {
    businessId: args.businessId,
    staffUserId: args.staffUserId,
    posSaleId: args.posSaleId,
    saleDate: args.saleDate,
  })
}

// ─── Post-commit telemetry ─────────────────────────────────────────────────

export function emitCheckoutCommissionAnalytics(
  outcome: CommissionCheckoutOutcome,
  ctx: { businessId: string; posSaleId: string; staffUserId: string }
): void {
  if (outcome.rowsWritten === 0) return
  analyticsEmit('commission_accrued', {
    businessId: ctx.businessId,
    posSaleId: ctx.posSaleId,
    staffUserId: ctx.staffUserId,
    rowsWritten: outcome.rowsWritten,
    totalCommissionPaise: outcome.totalCommissionPaise,
  })
}
