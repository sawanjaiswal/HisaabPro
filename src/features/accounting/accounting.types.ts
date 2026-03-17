/** Accounting — Type definitions (single source of truth) */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export type JournalEntryType =
  | 'SALES'
  | 'PURCHASE'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'EXPENSE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'OPENING'

export type EntryStatus = 'DRAFT' | 'POSTED' | 'VOID'

export interface LedgerAccount {
  id: string
  code: string
  name: string
  type: AccountType
  subType: string | null
  parentId: string | null
  description: string | null
  isSystem: boolean
  isActive: boolean
  /** Balance in paise */
  balance: number
  children?: LedgerAccount[]
}

export interface JournalEntryLine {
  id: string
  accountId: string
  /** Debit amount in paise */
  debit: number
  /** Credit amount in paise */
  credit: number
  narration: string | null
  partyId: string | null
  account?: {
    code: string
    name: string
    type: string
  }
}

export interface JournalEntry {
  id: string
  entryNumber: string
  date: string
  narration: string | null
  type: JournalEntryType
  status: EntryStatus
  sourceType: string | null
  sourceNumber: string | null
  /** Total debit in paise */
  totalDebit: number
  /** Total credit in paise */
  totalCredit: number
  lines: JournalEntryLine[]
  createdAt: string
}

export interface TrialBalanceRow {
  accountId: string
  code: string
  name: string
  type: string
  subType: string | null
  /** In paise */
  totalDebit: number
  /** In paise */
  totalCredit: number
  /** In paise */
  netBalance: number
}

export interface TrialBalanceTotals {
  /** In paise */
  debit: number
  /** In paise */
  credit: number
}

export interface TrialBalanceData {
  rows: TrialBalanceRow[]
  totals: TrialBalanceTotals
}

export interface AccountListResponse {
  items: LedgerAccount[]
  total: number
  page: number
  limit: number
}

export interface JournalEntryListResponse {
  items: JournalEntry[]
  total: number
  page: number
  limit: number
}

export interface JournalEntryFilters {
  type?: JournalEntryType
  status?: EntryStatus
  page?: number
  limit?: number
}
