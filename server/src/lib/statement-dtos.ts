/**
 * Statement DTOs — TypeScript interfaces for Customer Statement endpoint.
 *
 * All monetary amounts are in paise (integer).
 * agingDays is only present on document-type rows (invoices, credit/debit notes).
 */

export interface StatementParty {
  id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  billingAddress: string | null
}

export interface StatementBusiness {
  name: string
  gstin: string | null
  phone: string | null
  logoUrl: string | null
}

export interface StatementPeriod {
  from: string // ISO date string YYYY-MM-DD
  to: string   // ISO date string YYYY-MM-DD
}

/** A single row in the statement ledger. */
export interface StatementTransaction {
  date: string         // ISO date string
  type: string         // SALE_INVOICE | CREDIT_NOTE | DEBIT_NOTE | PAYMENT_IN | PAYMENT_OUT | OPENING_BALANCE
  reference: string    // invoice/payment number or label
  description: string  // human-readable line description
  debitPaise: number   // amount added to balance (invoices, debit notes)
  creditPaise: number  // amount subtracted from balance (payments in, credit notes)
  balancePaise: number // running balance after this row
  agingDays?: number   // days outstanding (only for invoice-type rows)
}

export interface StatementDataRes {
  party: StatementParty
  business: StatementBusiness
  period: StatementPeriod
  openingBalancePaise: number
  transactions: StatementTransaction[]
  closingBalancePaise: number
  generatedAt: string // ISO datetime
}
