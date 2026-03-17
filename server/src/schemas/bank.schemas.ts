/**
 * Bank Account Zod Schemas — validation for all bank account endpoints
 */

import { z } from 'zod'

const ACCOUNT_TYPES = ['CURRENT', 'SAVINGS', 'OD', 'CC'] as const

// === Create ===

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1).max(100),
  accountNumber: z.string().min(1).max(50),
  ifscCode: z.string().max(20).optional(),
  branchName: z.string().max(100).optional(),
  accountType: z.enum(ACCOUNT_TYPES).default('CURRENT'),
  openingBalance: z.number().int().default(0),
  isDefault: z.boolean().default(false),
})

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>

// === Update ===

export const updateBankAccountSchema = createBankAccountSchema.partial()

export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>

// === List ===

export const listBankAccountsSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListBankAccountsQuery = z.infer<typeof listBankAccountsSchema>
