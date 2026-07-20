/** Customer Statement — view helpers (mockup #47).
 *
 * The mockup's chips read All / Invoices / Payments / Returns, which is a
 * coarser vocabulary than the seven stored transaction types. The translation
 * lives here so the chips, the row tint and the aria label can never disagree.
 *
 * Filtering happens in memory: the statement endpoint returns the party's
 * whole ledger page, and narrowing it server-side would break the running
 * balance the rows below still have to add up to.
 */

import type { StatementTransaction, StatementTransactionType } from './report.types'

export type StatementViewFilter = 'ALL' | 'INVOICES' | 'PAYMENTS' | 'RETURNS'

const FILTER_TYPES: Record<
  Exclude<StatementViewFilter, 'ALL'>,
  ReadonlySet<StatementTransactionType>
> = {
  INVOICES: new Set<StatementTransactionType>(['sale_invoice', 'purchase_invoice']),
  PAYMENTS: new Set<StatementTransactionType>(['payment_received', 'payment_made']),
  RETURNS: new Set<StatementTransactionType>(['credit_note', 'debit_note']),
}

/** Opening balance is context, not a transaction — it survives every chip. */
export function matchesStatementFilter(
  txn: StatementTransaction,
  filter: StatementViewFilter,
): boolean {
  if (filter === 'ALL') return true
  if (txn.type === 'opening_balance') return true
  return FILTER_TYPES[filter].has(txn.type)
}

export type StatementRowTone = 'debit' | 'credit' | 'neutral'

/** Debit = the party owes more (red); credit = they settled (green). */
export function statementRowTone(txn: StatementTransaction): StatementRowTone {
  if (txn.debit > 0) return 'debit'
  if (txn.credit > 0) return 'credit'
  return 'neutral'
}

/** The single number a row shows — credits print with a leading minus. */
export function statementRowAmount(txn: StatementTransaction): number {
  return txn.debit > 0 ? txn.debit : -txn.credit
}
