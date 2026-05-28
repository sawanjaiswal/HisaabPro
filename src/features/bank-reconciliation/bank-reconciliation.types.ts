/** #147 Bank reconciliation — frontend types. Amounts in paise (Int). */

export type LineDirection = 'CREDIT' | 'DEBIT'
export type LineStatus = 'UNMATCHED' | 'SUGGESTED' | 'MATCHED' | 'IGNORED'

/** A row parsed from the user's CSV, client-side, before upload. */
export interface ParsedCsvRow {
  txnDate: string // ISO date
  amount: number // paise, > 0
  direction: LineDirection
  description: string | null
  referenceNumber: string | null
}

export interface CreateImportInput {
  bankAccountId: string
  fileName: string
  rows: ParsedCsvRow[]
}

export interface LineWithSuggestion {
  id: string
  txnDate: string
  amount: number
  direction: LineDirection
  description: string | null
  referenceNumber: string | null
  status: LineStatus
  suggestedPaymentId: string | null
  confidence: number
  matchedPaymentId: string | null
}

export interface CreateImportResult {
  importId: string
  lines: LineWithSuggestion[]
  poolTruncated: boolean
  duplicateCount: number
}

export interface ReconLine {
  id: string
  txnDate: string
  amount: number
  direction: LineDirection
  description: string | null
  referenceNumber: string | null
  status: LineStatus
  matchedPaymentId: string | null
  confidence: number
}

export interface ListLinesResult {
  lines: ReconLine[]
  nextCursor: string | null
}

export type ReconTab = 'SUGGESTED' | 'UNMATCHED' | 'MATCHED' | 'IGNORED'
