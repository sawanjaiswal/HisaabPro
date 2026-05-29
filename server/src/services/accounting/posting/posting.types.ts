/**
 * GL auto-posting — shared types.
 *
 * A PostingLine references a ledger account by its stable seeded `code`
 * (SSOT — never by name/subType; see N4 fix in fy-closure/close.ts). The
 * persistence layer resolves code → accountId within the caller's transaction.
 */
import { prisma } from '../../../lib/prisma.js'

/**
 * Prisma transaction client (the arg `prisma.$transaction(async (tx) => …)`
 * yields). The project's client is `$extends`-extended, so the real interactive
 * tx type is NOT `Prisma.TransactionClient` — it must be extracted from the
 * extended client's `$transaction` signature, mirroring document/helpers.ts.
 */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** One debit-or-credit leg, account identified by seeded code. Paise. */
export interface PostingLine {
  code: string
  debit: number
  credit: number
  narration?: string
  partyId?: string
}

/** Result of a pure map function: the JE `type` + its balanced lines. */
export interface PostingMap {
  type: string // SALES, PURCHASE, RECEIPT, PAYMENT, EXPENSE, CREDIT_NOTE, DEBIT_NOTE
  lines: PostingLine[]
}

/** Identifies the source record a JE is posted from (idempotency key). */
export interface PostingSource {
  sourceType: 'DOCUMENT' | 'PAYMENT' | 'EXPENSE'
  sourceId: string
  sourceNumber: string | null
}

/** Everything the persistence layer needs to write one POSTED JournalEntry. */
export interface PostingContext extends PostingSource {
  businessId: string
  userId: string
  date: Date
  narration: string
}

/** System account codes this module relies on. assertSystemAccounts checks these. */
export const REQUIRED_CODES = [
  '1000', // Cash in Hand
  '1100', // Bank Accounts
  '1200', // Accounts Receivable
  '1250', // TDS Receivable (new)
  '1300', // Inventory
  '2000', // Accounts Payable
  '2100', // Tax Payable
  '2200', // TDS Payable
  '2300', // TCS Payable (new)
  '4000', // Sales Revenue
  '4100', // Other Income
  '5050', // COGS (new)
  '5100', // Direct Expenses
  '5200', // Indirect Expenses
  '5400', // Round Off (new)
] as const
