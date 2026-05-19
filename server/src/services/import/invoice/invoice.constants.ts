/**
 * Phase 7 · 7.1C — Invoice import constants.
 *
 * Authority: ARCHITECTURE_PHASE7_IMPORT_7_1C.md §5 (error-code union),
 * §6 (statement order), §7 (pathology table row 13 — lines cap).
 *
 * Centralised here so the normalizer, resolvers, commit ladder, and FE
 * preview cards share one source of truth for codes + caps. Severity is
 * fixed (not data-driven) — chips pick colour from this map.
 */

export type InvoiceIssueCode =
  | 'INVOICE_NUMBER_REQUIRED'
  | 'INVALID_DATE'
  | 'NO_LINES'
  | 'HEADER_MISMATCH_WITHIN_INVOICE'
  | 'PARTY_NOT_FOUND'
  | 'PARTY_AUTO_CREATED'
  | 'PARTY_NAME_ONLY_MATCH'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_AMBIGUOUS'
  | 'TAX_MATH_MISMATCH'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'AMOUNT_NEGATIVE'
  | 'DUPLICATE_EXACT'
  | 'DUPLICATE_INVOICE_NUMBER'
  | 'INTRA_FILE_DUPLICATE'
  | 'LINES_PER_INVOICE_EXCEEDED'

export type InvoiceIssueSeverity = 'ERROR' | 'WARNING'

export const INVOICE_ISSUE_SEVERITY: Record<InvoiceIssueCode, InvoiceIssueSeverity> = {
  INVOICE_NUMBER_REQUIRED: 'ERROR',
  INVALID_DATE: 'ERROR',
  NO_LINES: 'ERROR',
  HEADER_MISMATCH_WITHIN_INVOICE: 'ERROR',
  PARTY_NOT_FOUND: 'ERROR',
  PARTY_AUTO_CREATED: 'WARNING',
  PARTY_NAME_ONLY_MATCH: 'WARNING',
  PRODUCT_NOT_FOUND: 'ERROR',
  PRODUCT_AMBIGUOUS: 'ERROR',
  TAX_MATH_MISMATCH: 'WARNING',
  AMOUNT_OUT_OF_RANGE: 'ERROR',
  AMOUNT_NEGATIVE: 'ERROR',
  DUPLICATE_EXACT: 'ERROR',
  DUPLICATE_INVOICE_NUMBER: 'ERROR',
  INTRA_FILE_DUPLICATE: 'ERROR',
  LINES_PER_INVOICE_EXCEEDED: 'ERROR',
}

/**
 * Hard cap on `DocumentLineItem` rows per invoice. Above this, the row
 * is rejected pre-commit with `LINES_PER_INVOICE_EXCEEDED` (§7 row 13).
 * Picked to keep the chunk tx bounded under the 1k-statement budget.
 */
export const LINES_PER_INVOICE_CAP = 1000

/**
 * Max paise representable as Postgres Int4 (Document.grandTotal column).
 * Used by `narrowPaiseToInt()` to reject overflow without throwing.
 * 2_147_483_647 paise = Rs 2,14,74,836.47 ≈ Rs 2.14 crore — adequate for
 * a single-invoice cap. Bigger totals are split across multiple docs.
 */
export const AMOUNT_MAX = 2_147_483_647n

/**
 * Tolerance for tax-math reconciliation (in paise). Source documents
 * round line-level CGST/SGST independently, so summing lines can drift
 * by up to ±50 paise from the header total. Within tolerance → emit
 * WARNING `TAX_MATH_MISMATCH`; beyond → reject.
 */
export const TAX_MATCH_TOLERANCE_PAISE = 50n

/**
 * Party-resolution mode requested at upload time. See SCOPE
 * "Party resolution" section — controls fly-create vs strict matching.
 */
export type PartyResolutionMode = 'MATCH_OR_FLY_CREATE' | 'REQUIRE_PARTIES_FIRST'
