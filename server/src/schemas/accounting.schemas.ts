/**
 * Accounting Schemas — Zod validation for Journal Entries, Ledger Accounts, and Reports.
 * All monetary amounts are in PAISE (integer). No floating-point money.
 */

import { z } from 'zod'

// ─── Enums ─────────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const
const ENTRY_TYPES = [
  'SALES',
  'PURCHASE',
  'RECEIPT',
  'PAYMENT',
  'CONTRA',
  'JOURNAL',
  'EXPENSE',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'OPENING',
] as const
const ENTRY_STATUSES = ['DRAFT', 'POSTED', 'VOID'] as const

// ─── Journal Entry Line ────────────────────────────────────────────────────────

const journalEntryLineSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  debit: z.number().int('debit must be an integer (paise)').min(0, 'debit must be >= 0').default(0),
  credit: z.number().int('credit must be an integer (paise)').min(0, 'credit must be >= 0').default(0),
  narration: z.string().max(500).optional(),
  partyId: z.string().optional(),
})

// ─── Create Journal Entry ──────────────────────────────────────────────────────

export const createJournalEntrySchema = z
  .object({
    date: z.coerce.date({ required_error: 'date is required' }),
    narration: z.string().max(1000).optional(),
    type: z.enum(ENTRY_TYPES, { required_error: 'type is required' }),
    lines: z
      .array(journalEntryLineSchema)
      .min(2, 'A journal entry must have at least 2 lines'),
  })
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)
      return totalDebit === totalCredit
    },
    { message: 'Total debits must equal total credits', path: ['lines'] },
  )
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
      return totalDebit > 0
    },
    { message: 'Journal entry cannot have zero totals', path: ['lines'] },
  )

// ─── List Journal Entries ──────────────────────────────────────────────────────

export const listJournalEntriesSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(ENTRY_TYPES).optional(),
  status: z.enum(ENTRY_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Create Ledger Account ─────────────────────────────────────────────────────

export const createLedgerAccountSchema = z.object({
  code: z.string().min(1, 'code is required').max(10, 'code must be 10 characters or fewer'),
  name: z.string().min(1, 'name is required').max(200),
  type: z.enum(ACCOUNT_TYPES, { required_error: 'type is required' }),
  subType: z.string().max(50).optional(),
  parentId: z.string().optional(),
  description: z.string().max(500).optional(),
})

// ─── Update Ledger Account ─────────────────────────────────────────────────────

export const updateLedgerAccountSchema = z.object({
  code: z.string().min(1).max(10).optional(),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  subType: z.string().max(50).optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

// ─── List Ledger Accounts ──────────────────────────────────────────────────────

export const listLedgerAccountsSchema = z.object({
  type: z.enum(ACCOUNT_TYPES).optional(),
  subType: z.string().max(50).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// ─── Trial Balance Query ───────────────────────────────────────────────────────

export const trialBalanceQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
})

// ─── Void Entry ────────────────────────────────────────────────────────────────

export const voidJournalEntrySchema = z.object({
  reason: z.string().min(1, 'reason is required').max(500),
})

// ─── Ledger Report Query ───────────────────────────────────────────────────────

export const ledgerReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

// ─── Day Book Query ────────────────────────────────────────────────────────────

export const dayBookQuerySchema = z.object({
  date: z.coerce.date({ required_error: 'date is required' }),
})

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>
export type ListJournalEntriesQuery = z.infer<typeof listJournalEntriesSchema>
export type CreateLedgerAccountInput = z.infer<typeof createLedgerAccountSchema>
export type UpdateLedgerAccountInput = z.infer<typeof updateLedgerAccountSchema>
export type ListLedgerAccountsQuery = z.infer<typeof listLedgerAccountsSchema>
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>
export type VoidJournalEntryInput = z.infer<typeof voidJournalEntrySchema>
export type LedgerReportQuery = z.infer<typeof ledgerReportQuerySchema>
export type DayBookQuery = z.infer<typeof dayBookQuerySchema>
