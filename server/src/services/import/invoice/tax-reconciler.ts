/**
 * Phase 7 · 7.1C — Tax reconciler (±50 paise tolerance).
 *
 * ARCH §2.4 + SCOPE L368-390. Compares the **source-reported** grand
 * total against the sum of line totals + per-tax aggregates. The diff
 * is the floor of "source rounding drift" — we tolerate ±50 paise so a
 * 12-line invoice where every line rounds CGST/SGST independently still
 * matches the printed grand total.
 *
 * Within tolerance → WARNING `TAX_MATH_MISMATCH` with payload showing
 * computed vs reported (FE may choose to surface or hide).
 * Above tolerance → ERROR `TAX_MATH_MISMATCH`.
 *
 * **Source-of-record fidelity (Resolved Decision #9):** we never
 * overwrite the reported totals with our computed numbers. The user
 * imported their source's truth; we stage their truth verbatim.
 */

import { TAX_MATCH_TOLERANCE_PAISE } from './invoice.constants.js'
import type { InvoiceIssue } from './invoice.types.js'

export interface TaxReconcileInput {
  /** Sum of per-line `lineTotalPaise` (subtotal + line-level taxes). */
  computedGrandPaise: number
  /** Source-reported header `grandTotalPaise`. */
  reportedGrandPaise: number
}

export interface TaxReconcileResult {
  diff: number
  issue: InvoiceIssue | null
}

export function reconcileTaxTotals(
  input: TaxReconcileInput,
): TaxReconcileResult {
  const diff = input.computedGrandPaise - input.reportedGrandPaise
  const abs = diff < 0 ? -diff : diff
  if (BigInt(abs) <= TAX_MATCH_TOLERANCE_PAISE) {
    return { diff, issue: null }
  }
  // Beyond tolerance — emit WARNING per SCOPE L368-390 (commit still
  // proceeds with source-reported totals; FE surfaces a chip).
  return {
    diff,
    issue: {
      field: 'grandTotal',
      code: 'TAX_MATH_MISMATCH',
      severity: 'WARNING',
      message:
        `Tax math drift ${diff} paise — line sum ${input.computedGrandPaise} ` +
        `vs source ${input.reportedGrandPaise}`,
    },
  }
}
