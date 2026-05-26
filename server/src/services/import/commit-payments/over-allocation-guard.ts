/**
 * Phase 7 · 7.1D PR-D3 — Σ over-allocation guard.
 *
 * Before INSERT-ing a PaymentAllocation row, we MUST guarantee that the
 * sum of every ACTIVE PaymentAllocation pointing at the target Document,
 * plus the incoming amountPaise, does not exceed the invoice's
 * outstanding balance:
 *
 *   outstanding = Document.grandTotal
 *               - Σ (PaymentAllocation.amount
 *                    WHERE allocation.invoiceId = doc.id
 *                      AND Payment.isDeleted = false)
 *
 * The Document row is `SELECT ... FOR UPDATE` to serialise concurrent
 * allocation attempts on the same invoice. Soft-deleted Payments (which
 * cascade-delete their allocations? — NO, allocations are independent
 * rows so we filter them explicitly) are excluded from Σ.
 *
 * 50×Rs250 vs Rs10,000 outstanding scenario:
 *   First 40 rows committed → Σ = 40 × 25_000 paise = 10_00_000 paise.
 *   Row 41: outstanding becomes 0 → guard throws OVER_ALLOCATION.
 *   Rows 41-50 (10 rows) → marked OVER_ALLOCATION, NOT thrown out of
 *   the tx (the row-level error is caught by the caller).
 *
 * Authority:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6 Σ-guard
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md S5 (tenancy on Document)
 */

import { AppError, ErrorCode } from '../../../lib/errors.js'
import type { Tx } from '../commit.helpers.js'

export interface OverAllocationCheckArgs {
  tx: Tx
  /** Document.id — the invoice this payment row allocates against. */
  invoiceId: string
  /** Tenancy guard — confirms invoiceId belongs to this business. */
  businessId: string
  /** Paise to be allocated by THIS row. Must be > 0. */
  amountPaise: number
}

interface DocOutstandingRow {
  id: string
  businessId: string
  grandTotal: number
  isDeleted: boolean
}

interface SumRow {
  sum: bigint | number | null
}

/**
 * Throws:
 *   - `INVOICE_NOT_FOUND` (404) if the Document is missing OR not in
 *     this business OR soft-deleted.
 *   - `OVER_ALLOCATION` (422) if amountPaise > outstanding.
 *   - `ALLOCATION_INTERNAL_CONFLICT` (500) if outstanding < 0 (math
 *     drift — should never happen; surfaces as 5xx not 4xx).
 *
 * Returns the remaining outstanding-after-this-allocation so the
 * caller can log it (DEBUG only — PII-safe value, no party / amount
 * raw cell content).
 */
export async function assertNoOverAllocation(
  args: OverAllocationCheckArgs,
): Promise<{ outstandingBefore: number; outstandingAfter: number }> {
  const { tx, invoiceId, businessId, amountPaise } = args

  // 1. SELECT FOR UPDATE the Document — serialises concurrent
  //    allocations on the same invoice within the chunk tx window.
  //    Tenancy is filtered in the WHERE so a leaked invoiceId from
  //    another business yields zero rows → INVOICE_NOT_FOUND.
  const docs = await tx.$queryRaw<DocOutstandingRow[]>`
    SELECT id, "businessId", "grandTotal", "isDeleted"
    FROM "Document"
    WHERE id = ${invoiceId}
      AND "businessId" = ${businessId}
      AND "isDeleted" = false
    FOR UPDATE
  `
  const doc = docs[0]
  if (!doc) {
    throw new AppError(
      ErrorCode.INVOICE_NOT_FOUND,
      404,
      'Target invoice not found in this business',
      { invoiceId },
    )
  }

  // 2. Σ active allocations against this invoice.
  //    JOIN through Payment so we can filter on `Payment.isDeleted=false`
  //    — soft-deleted payments should NOT count against the allocation
  //    budget (otherwise restoring a payment would silently over-allocate).
  const sumRows = await tx.$queryRaw<SumRow[]>`
    SELECT COALESCE(SUM(pa.amount), 0)::bigint AS sum
    FROM "PaymentAllocation" pa
    JOIN "Payment" p ON p.id = pa."paymentId"
    WHERE pa."invoiceId" = ${invoiceId}
      AND p."isDeleted" = false
  `
  const sumRaw = sumRows[0]?.sum ?? 0
  const sumActive = typeof sumRaw === 'bigint' ? Number(sumRaw) : Number(sumRaw)

  const outstandingBefore = doc.grandTotal - sumActive
  if (outstandingBefore < 0) {
    // Math drift — surfaces as 5xx, distinct from OVER_ALLOCATION (4xx).
    throw new AppError(
      ErrorCode.ALLOCATION_INTERNAL_CONFLICT,
      500,
      'Allocation Σ exceeds invoice total — ledger integrity issue',
      { invoiceId },
    )
  }

  if (amountPaise > outstandingBefore) {
    throw new AppError(
      ErrorCode.OVER_ALLOCATION,
      422,
      'Payment amount exceeds invoice outstanding balance',
      {
        // PII-safe: ids + paise math only, no party / reference data.
        invoiceId,
        outstandingPaise: outstandingBefore,
        attemptedPaise: amountPaise,
      },
    )
  }

  return {
    outstandingBefore,
    outstandingAfter: outstandingBefore - amountPaise,
  }
}
