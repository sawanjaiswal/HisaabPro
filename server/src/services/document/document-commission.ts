/**
 * Commission #128 — Document accrual splice + post-commit analytics helper.
 *
 * Extracted from create.ts + update.ts to keep both files under the 250L
 * limit while sharing identical splice + telemetry semantics.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.3 (in-tx accrual),
 * §3.8 (post-commit side-effect rule).
 *
 * Two entries:
 *  - `accrueForSaleInvoice(tx, ...)` — call INSIDE the document
 *    `$transaction`. Returns the accrual outcome (or null when type is not
 *    SALE_INVOICE) so the caller can fire post-commit analytics.
 *  - `emitDocumentCommissionAnalytics(outcome, ctx)` — call AFTER the tx
 *    resolves. Defers via queueMicrotask so the telemetry never blocks the
 *    response.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { analyticsEmit } from '../../lib/analytics.js'
import { accrueForDocument } from '../commission/commission-accrual.service.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface DocumentCommissionOutcome {
  rowsWritten: number
  totalCommissionPaise: number
}

export interface DocumentCommissionArgs {
  businessId: string
  staffUserId: string
  documentId: string
  documentDate: Date
  documentType: string
}

/**
 * Splice the commission accrual into the document tx. Returns null when the
 * document type is not SALE_INVOICE — callers can simply short-circuit on
 * `null` without a separate type guard.
 */
export async function accrueForSaleInvoice(
  tx: TxClient,
  args: DocumentCommissionArgs
): Promise<DocumentCommissionOutcome | null> {
  if (args.documentType !== 'SALE_INVOICE') return null
  const out = await accrueForDocument(tx, {
    businessId: args.businessId,
    staffUserId: args.staffUserId,
    documentId: args.documentId,
    documentDate: args.documentDate,
  })
  return out
}

/**
 * Post-commit telemetry. `outcome` is the value returned from
 * `accrueForSaleInvoice` (closure-captured by the caller). Cast inside the
 * helper so the caller does not need its own TS-narrowing workaround.
 */
export function emitDocumentCommissionAnalytics(
  outcome: DocumentCommissionOutcome | null,
  ctx: { businessId: string; documentId: string; staffUserId: string }
): void {
  // TS closure-flow analysis collapses the caller's `let outcome` to its
  // initializer past an `await`; the cast re-widens before the guard runs.
  const accrued = outcome as DocumentCommissionOutcome | null
  if (!accrued || accrued.rowsWritten <= 0) return
  const a = accrued
  queueMicrotask(() => analyticsEmit('commission_accrued', {
    businessId: ctx.businessId,
    documentId: ctx.documentId,
    staffUserId: ctx.staffUserId,
    rowsWritten: a.rowsWritten,
    totalCommissionPaise: a.totalCommissionPaise,
  }))
}
