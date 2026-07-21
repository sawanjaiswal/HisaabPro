/**
 * Party Ledger — shared types and Zod schemas.
 * Imported by ledger.service.ts and routes/party.ts.
 */

import { z } from 'zod'

// Voucher types accepted by the filter
export const LEDGER_VOUCHER_TYPES = [
  'SALE', 'PURCHASE', 'PAYMENT', 'CN', 'DN', 'JE', 'OTHER',
] as const

export type LedgerVoucherType = typeof LEDGER_VOUCHER_TYPES[number]

/**
 * Settlement state of the source document, for the ledger row's status pill.
 * Derived (not stored): OVERDUE outranks PARTIAL/PENDING because a past-due
 * invoice is the thing the user has to act on, whatever it has been part-paid.
 * Payment and journal rows have no settlement state and carry no status.
 */
export type LedgerRowStatus = 'DRAFT' | 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE'

// Query schema (for route param parsing)
export const ledgerQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
    .refine(s => !isNaN(Date.parse(s)), 'from must be a valid date'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
    .refine(s => !isNaN(Date.parse(s)), 'to must be a valid date'),
  voucherTypes: z
    .string()
    .optional()
    .transform(s =>
      s ? (s.split(',').filter(t => LEDGER_VOUCHER_TYPES.includes(t as LedgerVoucherType)) as LedgerVoucherType[]) : undefined
    ),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform(s => Math.min(200, Math.max(1, parseInt(s ?? '50', 10) || 50))),
})

export type LedgerQuery = z.infer<typeof ledgerQuerySchema>

// A single ledger row as returned by the service
export interface LedgerRow {
  id: string
  source: 'DOCUMENT' | 'PAYMENT' | 'JOURNAL'
  date: string        // YYYY-MM-DD
  voucherType: LedgerVoucherType
  voucherNumber: string
  particulars: string
  dr: number          // paise — 0 if credit row
  cr: number          // paise — 0 if debit row
  runningBalance: number // paise — signed (positive = receivable)
  /** Number of line items on the source document (0 for payments/journal). */
  itemCount?: number
  /** Payment mode (CASH/UPI/…) — present only on PAYMENT rows. */
  mode?: string
  /** Settlement state — present only on DOCUMENT rows. */
  status?: LedgerRowStatus
}

// Cursor payload encoded as base64 JSON
export interface LedgerCursor {
  lastDate: string  // ISO string
  lastId: string
  lastSource: 'DOCUMENT' | 'PAYMENT' | 'JOURNAL'
}

export function encodeCursor(c: LedgerCursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64')
}

export function decodeCursor(s: string): LedgerCursor | null {
  try {
    return JSON.parse(Buffer.from(s, 'base64').toString('utf8')) as LedgerCursor
  } catch {
    return null
  }
}
