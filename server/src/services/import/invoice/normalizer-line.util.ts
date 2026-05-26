/**
 * Phase 7 · 7.1C — Per-line normalization helpers.
 *
 * Carved out of `normalizer.ts` to keep file caps ≤250L. Two responsibilities:
 *
 *   1. `paiseOrZero` — narrow a header paise field (defaults to 0 on null).
 *   2. `paiseOrNull` — narrow a per-line paise field (null on null) with
 *      `sourceLineIndex` carried into emitted issues so the FE chip
 *      points at the right source row.
 *   3. `parseQty` — non-paise quantity parse (qty is Decimal upstream).
 *
 * All three are pure; no I/O, no Prisma. Tested transitively via the
 * aggregator/normalizer suites; direct unit coverage is on
 * `narrowPaiseToInt` (amount-narrow.test.ts).
 */

import { narrowPaiseToInt } from './amount-narrow.util.js'
import { parsePaiseBigInt } from '../utils/price.util.js'
import type { InvoiceIssue } from './invoice.types.js'

export function paiseOrZero(
  raw: string | null,
  field: string,
  issues: InvoiceIssue[],
): number {
  if (raw === null || raw === '') return 0
  const parsed = parsePaiseBigInt(raw)
  if (parsed.value === null) {
    issues.push({
      field,
      code: 'AMOUNT_OUT_OF_RANGE',
      severity: 'ERROR',
      message: `Field '${field}' value '${raw}' is not a valid amount.`,
    })
    return 0
  }
  const narrowed = narrowPaiseToInt(parsed.value)
  if (!narrowed.ok) {
    issues.push({
      field,
      code: narrowed.code,
      severity: 'ERROR',
      message: narrowed.code === 'AMOUNT_NEGATIVE'
        ? `Negative total in '${field}' — use the credit-note flow.`
        : `Field '${field}' total too large — split into smaller invoices.`,
    })
    return 0
  }
  return narrowed.value
}

export function paiseOrNull(
  raw: string | null,
  field: string,
  sourceLineIndex: number,
  issues: InvoiceIssue[],
): number | null {
  if (raw === null || raw === '') return null
  const parsed = parsePaiseBigInt(raw)
  if (parsed.value === null) {
    issues.push({
      field,
      code: 'AMOUNT_OUT_OF_RANGE',
      severity: 'ERROR',
      message: `Line ${sourceLineIndex + 1} '${field}' value '${raw}' invalid.`,
      sourceLineIndex,
    })
    return null
  }
  const narrowed = narrowPaiseToInt(parsed.value)
  if (!narrowed.ok) {
    issues.push({
      field,
      code: narrowed.code,
      severity: 'ERROR',
      message: narrowed.code === 'AMOUNT_NEGATIVE'
        ? `Line ${sourceLineIndex + 1} '${field}' is negative.`
        : `Line ${sourceLineIndex + 1} '${field}' overflows Int paise.`,
      sourceLineIndex,
    })
    return null
  }
  return narrowed.value
}

export function parseQty(raw: string | null): number {
  if (!raw) return 0
  const cleaned = raw.replace(/,/g, '').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
