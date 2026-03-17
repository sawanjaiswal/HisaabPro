/** Accounting — Constants (labels, colors, config) */

import type { AccountType, JournalEntryType, EntryStatus } from './accounting.types'

// ─── Account type labels ───────────────────────────────────────────────────────

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET:     'Assets',
  LIABILITY: 'Liabilities',
  EQUITY:    'Equity',
  INCOME:    'Income',
  EXPENSE:   'Expenses',
}

/** Ordered list for rendering account groups */
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
]

/** CSS variable strings — used as inline color values */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET:     'var(--color-info-600)',
  LIABILITY: 'var(--color-error-600)',
  EQUITY:    'var(--color-primary-500)',
  INCOME:    'var(--color-success-600)',
  EXPENSE:   'var(--color-warning-600)',
}

export const ACCOUNT_TYPE_BG: Record<AccountType, string> = {
  ASSET:     'var(--color-info-50)',
  LIABILITY: 'var(--color-error-50)',
  EQUITY:    'var(--color-primary-50)',
  INCOME:    'var(--color-success-50)',
  EXPENSE:   'var(--color-warning-50)',
}

// ─── Journal entry type labels ─────────────────────────────────────────────────

export const JOURNAL_TYPE_LABELS: Record<JournalEntryType, string> = {
  SALES:       'Sales',
  PURCHASE:    'Purchase',
  RECEIPT:     'Receipt',
  PAYMENT:     'Payment',
  CONTRA:      'Contra',
  JOURNAL:     'Journal',
  EXPENSE:     'Expense',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE:  'Debit Note',
  OPENING:     'Opening',
}

export const JOURNAL_TYPE_COLORS: Record<JournalEntryType, string> = {
  SALES:       'var(--color-primary-600)',
  PURCHASE:    'var(--color-info-600)',
  RECEIPT:     'var(--color-success-600)',
  PAYMENT:     'var(--color-error-600)',
  CONTRA:      'var(--color-gray-600)',
  JOURNAL:     'var(--color-gray-700)',
  EXPENSE:     'var(--color-warning-600)',
  CREDIT_NOTE: 'var(--color-warning-600)',
  DEBIT_NOTE:  'var(--color-warning-600)',
  OPENING:     'var(--color-gray-500)',
}

// ─── Entry status labels & colors ──────────────────────────────────────────────

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  DRAFT:  'Draft',
  POSTED: 'Posted',
  VOID:   'Void',
}

export const ENTRY_STATUS_COLORS: Record<EntryStatus, string> = {
  DRAFT:  'var(--color-warning-600)',
  POSTED: 'var(--color-success-600)',
  VOID:   'var(--color-gray-500)',
}

export const ENTRY_STATUS_BG: Record<EntryStatus, string> = {
  DRAFT:  'var(--color-warning-bg-subtle)',
  POSTED: 'var(--color-success-bg-subtle)',
  VOID:   'var(--color-gray-100)',
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export const ACCOUNTING_PAGE_LIMIT = 25
