/** Party Statement — TypeScript types
 *
 * All monetary amounts are in PAISE (integer).
 */

import type { Pagination } from './report-shared.types'

// ─── Party Statement ───────────────────────────────────────────────────────────

/** Every possible transaction type that can appear in a party statement */
export type StatementTransactionType =
  | 'sale_invoice'
  | 'purchase_invoice'
  | 'payment_received'
  | 'payment_made'
  | 'credit_note'
  | 'debit_note'
  | 'opening_balance'

/** A single ledger row in the party statement */
export interface StatementTransaction {
  id: string
  date: string               // ISO date
  type: StatementTransactionType
  /** Human-readable document number or reference, e.g. "SI-0042" */
  reference: string
  /** ID of the source document (invoice, payment, etc.) */
  referenceId: string
  description: string
  debit: number              // paise — amount owed by party (receivable side)
  credit: number             // paise — amount owed to party (payable side)
  runningBalance: number     // paise — positive = receivable, negative = payable
}

/** Full data payload for a party statement */
export interface PartyStatementData {
  party: {
    id: string
    name: string
    phone: string
    type: 'customer' | 'supplier'
  }
  openingBalance: {
    amount: number           // paise
    type: 'receivable' | 'payable'
    asOfDate: string         // ISO date
  }
  closingBalance: {
    amount: number           // paise
    type: 'receivable' | 'payable'
    asOfDate: string         // ISO date
  }
  transactions: StatementTransaction[]
  totals: {
    totalDebit: number       // paise
    totalCredit: number      // paise
  }
}

/** Full response shape from GET /reports/party-statement/:partyId */
export interface PartyStatementResponse {
  success: boolean
  data: PartyStatementData
  meta: Pagination
}

/** Query parameters for the party statement endpoint */
export interface PartyStatementFilters {
  from?: string              // ISO date
  to?: string                // ISO date
  cursor?: string
  limit: number
}
