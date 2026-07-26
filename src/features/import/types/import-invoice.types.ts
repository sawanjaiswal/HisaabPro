/**
 * Phase 7 · 7.1C — invoice-side import types (FE mirror of the BE contract).
 *
 * Split out of import.types.ts when that file crossed the 250-line ceiling.
 * These types describe ONE entity (invoice rows); the party/product/job
 * contract stays in import.types.ts, which re-exports everything here so
 * existing `@/features/import/types/import.types` imports keep working.
 */

/**
 * 7.1C invoice-side issue codes (FE mirror of
 * server/services/import/invoice/invoice.constants.ts → `InvoiceIssueCode`).
 * Severity is fixed by BE — chip colour picked from severity table below.
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

export const INVOICE_ISSUE_SEVERITY: Record<InvoiceIssueCode, 'ERROR' | 'WARNING'> = {
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

/** FE mirror of server `ResolvedParty.matchedBy` for chip rendering. */
export type InvoicePartyMatchedBy =
  | 'BY_PHONE'
  | 'BY_NAME_AND_PHONE'
  | 'BY_NAME_ONLY'
  | 'FLY_CREATE'
  | 'NOT_FOUND'

/** FE mirror of server `ResolvedProductLine.matchedBy`. */
export type InvoiceProductMatchedBy = 'BY_SKU' | 'BY_NAME' | 'NOT_FOUND'

/** Wire shape of `row.issues[]` for invoice rows (mirrors BE InvoiceIssue). */
export interface InvoiceIssue {
  field: string | null
  code: InvoiceIssueCode
  severity: 'ERROR' | 'WARNING'
  message: string
  sourceLineIndex?: number
}

/**
 * FE-relevant subset of NormalizedInvoice (BE writes more). Carried inside
 * `row.normalized`. Paise are Int4 (≤ 2_147_483_647 — narrowed BE-side).
 */
export interface NormalizedInvoiceLine {
  source: {
    sourceLineIndex: number
    skuRaw: string | null
    productNameRaw: string | null
    qtyRaw: string | null
    unitRaw: string | null
  }
  resolved: {
    productId: string | null
    matchedBy: InvoiceProductMatchedBy
    source: { sku: string | null; name: string | null }
  }
  qty: number
  ratePaise: number | null
  taxableValuePaise: number | null
  cgstPaise: number | null
  sgstPaise: number | null
  igstPaise: number | null
  lineTotalPaise: number | null
}

export interface NormalizedInvoice {
  documentNumber: string
  documentDate: string // ISO yyyy-mm-dd
  party: {
    partyId: string | null
    matchedBy: InvoicePartyMatchedBy
    source: { name: string; phone: string | null }
  }
  lines: NormalizedInvoiceLine[]
  subtotalPaise: number
  totalCgstPaise: number
  totalSgstPaise: number
  totalIgstPaise: number
  grandTotalPaise: number
  notes: string | null
}
