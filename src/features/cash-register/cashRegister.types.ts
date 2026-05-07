/** Cash Register — TypeScript types matching backend DTOs */

export type CashEntryDirection = 'IN' | 'OUT'

export interface CashEntryDTO {
  id: string
  businessId: string
  direction: CashEntryDirection
  amountPaise: number
  expression: string
  note: string | null
  idempotencyKey: string
  editCount: number
  voidedAt: string | null        // ISO UTC
  voidedBy: string | null        // BusinessUser.id
  voidReason: string | null
  ledgerJournalId: string | null // reserved, always null in Phase 1
  createdBy: string              // BusinessUser.id
  createdAt: string              // ISO UTC
  updatedAt: string              // ISO UTC
}

export interface CashSummaryDTO {
  today: {
    inPaise: number
    outPaise: number
    netPaise: number
    count: number
  }
  last7Days: Array<{
    date: string       // YYYY-MM-DD local
    inPaise: number
    outPaise: number
    netPaise: number
    count: number
  }>
  last30: {
    inPaise: number
    outPaise: number
    netPaise: number
    count: number
  }
  range: { from: string; to: string } // ISO UTC start/end
}

export interface DayBucket {
  date: string           // YYYY-MM-DD
  entries: CashEntryDTO[]
  inPaise: number
  outPaise: number
  netPaise: number
}

export interface CashHistoryFilter {
  direction?: CashEntryDirection
  includeVoided: boolean
}

export interface CashHistorySort {
  by: 'newest' | 'oldest' | 'highest' | 'lowest'
}

export type CashRegisterTab = 'calculator' | 'history'

export type ExpressionError =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'INVALID_CHAR'
  | 'SYNTAX_ERROR'
  | 'DIVIDE_BY_ZERO'
  | 'INVALID_RESULT'
  | 'RESULT_OVERFLOW'

export interface ExpressionState {
  display: string
  error: ExpressionError | null
}

export interface SafeEvalResult {
  paise: number | null
  error: ExpressionError | null
}

export type ExpressionAction =
  | { type: 'APPEND_DIGIT'; digit: string }
  | { type: 'APPEND_OPERATOR'; op: string }
  | { type: 'APPEND_PAREN'; which: '(' | ')' }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR' }
