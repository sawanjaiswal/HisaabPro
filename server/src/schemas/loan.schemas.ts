/**
 * Loan Account Zod Schemas — validation for loan management endpoints
 */

import { z } from 'zod'

const LOAN_TYPES = ['LOAN_GIVEN', 'LOAN_TAKEN'] as const
const LOAN_STATUSES = ['ACTIVE', 'CLOSED', 'DEFAULTED'] as const
const LOAN_TRANSACTION_TYPES = ['EMI', 'INTEREST', 'PREPAYMENT', 'DISBURSEMENT', 'CLOSURE'] as const

// === Create Loan Account ===

export const createLoanSchema = z.object({
  type: z.enum(LOAN_TYPES),
  partyId: z.string().min(1).optional(),
  loanName: z.string().min(1).max(200),
  principalAmount: z.number().int().positive(),
  interestRate: z.number().int().min(0).default(0), // basis points annual
  tenure: z.number().int().positive().optional(), // months
  emiAmount: z.number().int().positive().optional(), // paise
  startDate: z.coerce.date({ message: 'startDate must be a valid date' }),
  endDate: z.coerce.date({ message: 'endDate must be a valid date' }).optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateLoanInput = z.infer<typeof createLoanSchema>

// === List Loan Accounts ===

export const listLoansSchema = z.object({
  type: z.enum(LOAN_TYPES).optional(),
  status: z.enum(LOAN_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListLoansQuery = z.infer<typeof listLoansSchema>

// === Record Loan Transaction ===

export const recordLoanTransactionSchema = z.object({
  type: z.enum(LOAN_TRANSACTION_TYPES),
  amount: z.number().int().positive(),
  principalAmount: z.number().int().min(0).optional(),
  interestAmount: z.number().int().min(0).optional(),
  date: z.coerce.date({ message: 'date must be a valid date' }),
  notes: z.string().max(1000).optional(),
})

export type RecordLoanTransactionInput = z.infer<typeof recordLoanTransactionSchema>
