/** GSTR-1 Reconciliation — Type definitions
 *
 * All monetary amounts in paise (integer) in API responses.
 * Input payload amounts are in rupees (float) — converted to paise before sending.
 */

export type MatchStatus =
  | 'MATCHED'
  | 'MISMATCHED'
  | 'MISSING_IN_GSTR'
  | 'EXTRA_IN_GSTR'

export type ReconStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export type ReconType = 'GSTR1_VS_BOOKS'

export interface GstrInputItem {
  invoiceNumber: string
  invoiceDate: string
  gstin: string
  partyName?: string
  taxableValue: number   // rupees float (user input)
  taxAmount: number      // rupees float (user input)
}

export interface ReconciliationSummary {
  id: string
  period: string
  reconType: ReconType
  status: ReconStatus
  totalInvoices: number
  matchedCount: number
  mismatchedCount: number
  missingInGstrCount: number
  extraInGstrCount: number
  totalBookValue: number       // paise
  totalGstrValue: number       // paise
  differenceValue: number      // paise
}

export interface ReconciliationEntry {
  id: string
  documentId: string
  documentNumber: string
  documentDate: string
  partyGstin: string
  partyName: string
  bookTaxableValue: number     // paise
  bookTaxAmount: number        // paise
  gstrInvoiceNumber: string | null
  gstrInvoiceDate: string | null
  gstrTaxableValue: number | null   // paise
  gstrTaxAmount: number | null      // paise
  matchStatus: MatchStatus
  taxableValueDiff: number     // paise
  taxAmountDiff: number        // paise
}

export interface ReconciliationListResponse {
  data: ReconciliationSummary[]
  total: number
  page: number
  limit: number
}

export interface ReconciliationEntriesResponse {
  data: ReconciliationEntry[]
  total: number
  page: number
  limit: number
}
