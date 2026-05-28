/** #147 Bank reconciliation — backend types (no float; paise are Int). */

export type LineDirection = 'CREDIT' | 'DEBIT'
export type LineStatus = 'UNMATCHED' | 'SUGGESTED' | 'MATCHED' | 'IGNORED'
export type MatchMethod = 'AUTO' | 'MANUAL'

/** A single parsed bank-statement row coming from the client (post CSV parse). */
export interface StatementRowInput {
  txnDate: string // ISO date
  amount: number // paise, > 0
  direction: LineDirection
  description?: string | null
  referenceNumber?: string | null
}

/** Minimal line shape the pure match engine scores against. */
export interface MatchableLine {
  id: string
  txnDate: string
  amount: number
  direction: LineDirection
  description: string | null
  referenceNumber: string | null
}

/** Minimal payment shape the pure match engine scores against. */
export interface CandidatePayment {
  id: string
  date: string // ISO date
  amount: number // paise
  type: string // PAYMENT_IN | PAYMENT_OUT | PAYROLL_IN | PAYROLL_OUT
  referenceNumber: string | null
  partyName: string | null
}

export type SuggestionStatus = 'SUGGESTED' | 'WEAK' | 'UNMATCHED'

/** Pure engine output for one line. */
export interface LineSuggestion {
  lineId: string
  suggestedPaymentId: string | null
  confidence: number // 0..100 integer
  status: SuggestionStatus
}

/** Line enriched with its best suggestion + (when persisted) confirmed match. */
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
