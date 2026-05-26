/**
 * Phase 7 · 7.1C — Amount narrowing (BigInt paise → safe Int paise).
 *
 * `Document.grandTotal` (and the line/CGST/SGST/IGST columns) are
 * Postgres `Int4` (Prisma `Int`). Importers carry totals as BigInt
 * through the normalizer to defer overflow checks until after
 * tax-reconciliation — narrowing too early would corrupt the source
 * total before we know whether the row will be staged or rejected.
 *
 * `narrowPaiseToInt()` is the single boundary that converts BigInt
 * paise → number, splitting the failure modes per AUDIT S3:
 *   - `AMOUNT_NEGATIVE`     — input < 0n (credit-note flow lives elsewhere)
 *   - `AMOUNT_OUT_OF_RANGE` — input > AMOUNT_MAX (2,147,483,647 paise)
 *
 * Both cases are issue codes, not exceptions — caller appends an
 * `InvoiceIssue` to the row and continues normalizing the remaining
 * lines so the preview is complete.
 *
 * ARCHITECTURE_PHASE7_IMPORT_7_1C.md §5 (S3 split) · §8 row 9.
 */

import { AMOUNT_MAX } from './invoice.constants.js'

export type NarrowResult =
  | { ok: true; value: number }
  | { ok: false; code: 'AMOUNT_OUT_OF_RANGE' | 'AMOUNT_NEGATIVE' }

export function narrowPaiseToInt(v: bigint): NarrowResult {
  if (v < 0n) {
    return { ok: false, code: 'AMOUNT_NEGATIVE' }
  }
  if (v > AMOUNT_MAX) {
    return { ok: false, code: 'AMOUNT_OUT_OF_RANGE' }
  }
  // Safe — AMOUNT_MAX (2,147,483,647) < Number.MAX_SAFE_INTEGER (2^53-1).
  return { ok: true, value: Number(v) }
}
