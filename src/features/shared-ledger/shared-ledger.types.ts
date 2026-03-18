/** Shared Ledger — Type definitions */

export interface LedgerShare {
  id: string
  partyId: string
  partyName: string
  shareToken: string
  recipientPhone?: string
  recipientEmail?: string
  expiresAt: string | null
  createdAt: string
  viewCount: number
  lastViewedAt: string | null
}

export interface CreateLedgerShareData {
  recipientPhone?: string
  recipientEmail?: string
  /** Expiry in days. null = never expires */
  expiryDays: number | null
}

export interface PublicLedgerData {
  businessName: string
  partyName: string
  transactions: PublicLedgerTransaction[]
  openingBalance: number
  closingBalance: number
  totalDebit: number
  totalCredit: number
  generatedAt: string
  expiresAt: string | null
}

export interface PublicLedgerTransaction {
  date: string
  reference: string
  description: string
  debit: number
  credit: number
  runningBalance: number
}
