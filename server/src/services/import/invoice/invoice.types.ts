/**
 * Phase 7 · 7.1C — Invoice import types.
 *
 * Three layers per row:
 *   1. `InvoiceHeader` / `InvoiceLine`     — raw-parsed shape (parser output).
 *   2. `NormalizedInvoice`                  — post-aggregation + tax-reconcile
 *                                             + amount-narrow + resolver outputs.
 *   3. `StagedInvoiceRow`                   — ImportJobRow.normalized payload
 *                                             written to DB; sourceIndex anchors
 *                                             back to the file row.
 *
 * Fields stay JSON-serialisable — amounts are paise (number once narrowed,
 * bigint pre-narrow); dates are ISO strings on the wire. Decimal/BigInt
 * stay inside the normalizer to avoid `JSON.stringify` lossiness.
 */

import type { InvoiceIssueCode } from './invoice.constants.js'

export interface InvoiceHeader {
  documentNumber: string | null
  documentDate: string | null // raw source text — normalizer converts to ISO
  partyNameRaw: string | null
  partyPhoneRaw: string | null
  partyGstinRaw: string | null
  // Header totals (raw string from source — parser does NOT coerce).
  subtotalRaw: string | null
  totalCgstRaw: string | null
  totalSgstRaw: string | null
  totalIgstRaw: string | null
  grandTotalRaw: string | null
  notes: string | null
}

export interface InvoiceLine {
  sourceLineIndex: number // index within this invoice (0-based)
  skuRaw: string | null
  productNameRaw: string | null
  qtyRaw: string | null
  unitRaw: string | null
  rateRaw: string | null
  discountRaw: string | null
  taxableValueRaw: string | null
  cgstRaw: string | null
  sgstRaw: string | null
  igstRaw: string | null
  lineTotalRaw: string | null
}

export interface InvoiceIssue {
  field: string | null
  code: InvoiceIssueCode
  severity: 'ERROR' | 'WARNING'
  message: string
  // Optional per-line anchor — set when the issue applies to one line
  // (e.g. PRODUCT_NOT_FOUND on a specific row inside the invoice).
  sourceLineIndex?: number
}

export interface ResolvedParty {
  partyId: string | null
  matchedBy: 'BY_PHONE' | 'BY_NAME_AND_PHONE' | 'BY_NAME_ONLY' | 'FLY_CREATE' | 'NOT_FOUND'
  source: { name: string; phone: string | null }
}

export interface ResolvedProductLine {
  productId: string | null
  matchedBy: 'BY_SKU' | 'BY_NAME' | 'NOT_FOUND'
  source: { sku: string | null; name: string | null }
}

export interface NormalizedInvoice {
  documentNumber: string
  documentDate: string // ISO yyyy-mm-dd (normalizer converts source text)
  party: ResolvedParty
  lines: Array<{
    source: InvoiceLine
    resolved: ResolvedProductLine
    // Narrowed paise totals (post amount-narrow). Null when narrow failed.
    qty: number
    ratePaise: number | null
    taxableValuePaise: number | null
    cgstPaise: number | null
    sgstPaise: number | null
    igstPaise: number | null
    lineTotalPaise: number | null
  }>
  // Header totals — narrowed paise.
  subtotalPaise: number
  totalCgstPaise: number
  totalSgstPaise: number
  totalIgstPaise: number
  grandTotalPaise: number
  notes: string | null
}

export interface StagedInvoiceRow {
  sourceIndex: number
  header: InvoiceHeader
  lines: InvoiceLine[]
  normalized: NormalizedInvoice | null
  issues: InvoiceIssue[]
}
