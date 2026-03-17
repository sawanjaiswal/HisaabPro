/** Reports — Tax Summary, HSN Summary, Tax Ledger, GST Returns, and TDS/TCS types
 *
 * All monetary amounts are in PAISE (integer).
 * Tax rates are in BASIS POINTS (1800 = 18.00%).
 * Display conversion: formatAmount() from report.utils.
 */

// ─── Shared Tax Totals ────────────────────────────────────────────────────────

/** Tax breakdown for a single document category (sales, purchases, etc.) */
export interface TaxTotals {
  taxableValue: number   // paise
  cgst: number           // paise
  sgst: number           // paise
  igst: number           // paise
  cess: number           // paise
  total: number          // paise
  count: number
}

// ─── Tax Summary ──────────────────────────────────────────────────────────────

export interface TaxSummaryFilters {
  from: string
  to: string
}

export interface TaxSummaryData {
  sales: TaxTotals
  purchases: TaxTotals
  creditNotes: TaxTotals
  debitNotes: TaxTotals
  netTaxLiability: number   // paise — (sales + debitNotes) − (purchases + creditNotes)
}

// ─── HSN Summary ──────────────────────────────────────────────────────────────

export interface HsnSummaryItem {
  hsnCode: string
  quantity: number
  taxableValue: number   // paise
  cgst: number           // paise
  sgst: number           // paise
  igst: number           // paise
  cess: number           // paise
  totalValue: number     // paise
}

export interface HsnSummaryData {
  items: HsnSummaryItem[]
}

// ─── Tax Ledger ───────────────────────────────────────────────────────────────

export interface TaxLedgerEntry {
  id: string
  date: string
  type: 'sale' | 'purchase' | 'credit_note' | 'debit_note'
  referenceNo: string
  partyName: string
  taxableValue: number   // paise
  cgst: number           // paise
  sgst: number           // paise
  igst: number           // paise
  cess: number           // paise
  total: number          // paise
}

export interface TaxLedgerPagination {
  total: number
  nextCursor: string | null
  limit: number
}

export interface TaxLedgerData {
  entries: TaxLedgerEntry[]
  pagination: TaxLedgerPagination
}

export interface TaxLedgerFilters {
  from: string
  to: string
  limit?: number
  cursor?: string
}

// ─── GST Returns ──────────────────────────────────────────────────────────────

export type GstReturnType = 'GSTR1' | 'GSTR3B' | 'GSTR9'

/** GSTR-1 invoice supply buckets */
export interface Gstr1Data {
  b2b: TaxTotals
  b2cl: TaxTotals
  b2cs: TaxTotals
  cdnr: TaxTotals
  cdnur: TaxTotals
}

/** GSTR-3B summary fields */
export interface Gstr3bData {
  outwardSupplies: TaxTotals
  inputTaxCredit: TaxTotals
  creditNoteAdjustment: TaxTotals
  netTaxPayable: number   // paise
}

/** GSTR-9 annual return summary */
export interface Gstr9Data {
  financialYear: string
  sales: TaxTotals
  purchases: TaxTotals
  creditNotes: TaxTotals
  debitNotes: TaxTotals
}

// ─── TDS / TCS ────────────────────────────────────────────────────────────────

/** A single invoice entry in the TDS/TCS report.
 *
 * Amounts in PAISE. Rates in BASIS POINTS (1800 = 18.00%).
 * tdsRate / tcsRate will be 0 when the tax type is not applicable.
 */
export interface TdsTcsEntry {
  id: string
  documentNumber: string
  documentDate: string
  grandTotal: number     // paise — invoice total before TDS/TCS
  tdsRate: number        // basis points (e.g. 200 = 2.00%)
  tdsAmount: number      // paise
  tcsRate: number        // basis points
  tcsAmount: number      // paise
  party: {
    id: string
    name: string
  }
}

/** Aggregated totals for the TDS/TCS report response */
export interface TdsTcsTotals {
  totalInvoiceValue: number   // paise
  totalTdsAmount: number      // paise
  totalTcsAmount: number      // paise
  invoiceCount: number
}

/** Full response shape from GET /api/reports/tds-tcs-summary */
export interface TdsTcsSummaryData {
  entries: TdsTcsEntry[]
  totals: TdsTcsTotals
  period: {
    from: string
    to: string
  }
}

/** Filter state for the TDS/TCS report.
 *
 * type: 'tds' | 'tcs' | 'all' — passed to the API as the `type` param.
 * partyId is optional — when set, filters to a single party's transactions.
 */
export interface TdsTcsFilters {
  from: string
  to: string
  type: 'tds' | 'tcs' | 'all'
  partyId?: string
}

// ─── GST Returns ──────────────────────────────────────────────────────────────

/** GSTR-1 export response */
export interface GstExportData {
  json: unknown
  fileName: string
  summary: {
    totalInvoices: number
    totalTaxableValue: number   // paise
    totalTax: number            // paise
  }
}
