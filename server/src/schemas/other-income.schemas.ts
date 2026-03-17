/**
 * Other Income Zod Schemas — validation for other income endpoints
 */

import { z } from 'zod'

const OTHER_INCOME_CATEGORIES = [
  'INTEREST',
  'RENT',
  'COMMISSION',
  'DISCOUNT_RECEIVED',
  'MISCELLANEOUS',
] as const

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const

// === Create ===

export const createOtherIncomeSchema = z.object({
  category: z.enum(OTHER_INCOME_CATEGORIES),
  amount: z.number().int().min(1),
  date: z.coerce.date({ message: 'date must be a valid date' }),
  paymentMode: z.enum(PAYMENT_MODES),
  bankAccountId: z.string().optional(),
  partyId: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().optional(),
})

export type CreateOtherIncomeInput = z.infer<typeof createOtherIncomeSchema>

// === Update ===

export const updateOtherIncomeSchema = createOtherIncomeSchema.partial()

export type UpdateOtherIncomeInput = z.infer<typeof updateOtherIncomeSchema>

// === List ===

export const listOtherIncomeSchema = z.object({
  category: z.enum(OTHER_INCOME_CATEGORIES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListOtherIncomeQuery = z.infer<typeof listOtherIncomeSchema>
