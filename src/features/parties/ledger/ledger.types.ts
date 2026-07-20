/** Party Ledger — TypeScript types matching backend response shape */

export type LedgerVoucherType =
  | 'SALE'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'JOURNAL'
  | 'OPENING'

export interface LedgerRow {
  id: string
  /** Which entity the row came from — drives per-row navigation. */
  source: 'DOCUMENT' | 'PAYMENT' | 'JOURNAL'
  date: string          // ISO date string YYYY-MM-DD
  voucherType: LedgerVoucherType
  particulars: string
  voucherNumber: string
  /** Debit amount in PAISE */
  dr: number
  /** Credit amount in PAISE */
  cr: number
  /** Running balance in PAISE — positive = debit (we owe), negative = credit (they owe) */
  runningBalance: number
  /** Line-item count on the source document (absent for payments/journal). */
  itemCount?: number
  /** Payment mode (CASH/UPI/…) — present only on PAYMENT rows. */
  mode?: string
}

export interface LedgerResponse {
  partyId: string
  partyName: string
  fromDate: string
  toDate: string
  /** Opening balance in PAISE */
  openingBalance: number
  /** Closing balance in PAISE */
  closingBalance: number
  rows: LedgerRow[]
  nextCursor: string | null
  totalCount: number
}

export interface LedgerParams {
  from: string    // YYYY-MM-DD
  to: string      // YYYY-MM-DD
  voucherTypes?: LedgerVoucherType[]
  cursor?: string
  limit?: number
}
