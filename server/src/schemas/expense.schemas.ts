/**
 * Expense Zod Schemas — validation for expense and expense category endpoints
 */

import { z } from 'zod'

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 'OTHER'] as const

// === Expense Category ===

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>

// === Create Expense ===

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().int().min(1),
  date: z.coerce.date({ message: 'date must be a valid date' }),
  paymentMode: z.enum(PAYMENT_MODES),
  bankAccountId: z.string().optional(),
  partyId: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().optional(),
  gstApplicable: z.boolean().optional().default(false),
  gstRate: z.number().int().min(0).optional().default(0),
  gstAmount: z.number().int().min(0).optional().default(0),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

// === Update Expense ===

export const updateExpenseSchema = createExpenseSchema.partial()

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>

// === List Expenses ===

export const listExpensesSchema = z.object({
  categoryId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListExpensesQuery = z.infer<typeof listExpensesSchema>
