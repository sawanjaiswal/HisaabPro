/** #147 Bank reconciliation — frontend constants. */
import type { ReconTab } from './bank-reconciliation.types'

export const MAX_CSV_ROWS = 2000

/** Header aliases (lower-cased) used to locate columns in an uploaded CSV. */
export const CSV_COLUMN_ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'tran date'],
  amount: ['amount', 'amt', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawal amt', 'dr', 'paid out'],
  credit: ['credit', 'deposit', 'deposit amt', 'cr', 'paid in'],
  type: ['type', 'dr/cr', 'cr/dr', 'direction'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks'],
  reference: ['reference', 'ref', 'ref no', 'cheque no', 'utr', 'transaction id'],
} as const

export const TABS: { key: ReconTab; labelKey: string }[] = [
  { key: 'SUGGESTED', labelKey: 'bankReconTabSuggested' },
  { key: 'UNMATCHED', labelKey: 'bankReconTabUnmatched' },
  { key: 'MATCHED', labelKey: 'bankReconTabMatched' },
  { key: 'IGNORED', labelKey: 'bankReconTabIgnored' },
]

/** Confidence bands → semantic colour token. */
export function confidenceColor(score: number): string {
  if (score >= 70) return 'var(--color-success-600)'
  if (score >= 50) return 'var(--color-warning-600)'
  return 'var(--color-text-secondary)'
}
