/**
 * Cheque Zod Schemas — validation for cheque management endpoints
 */

import { z } from 'zod'

const CHEQUE_TYPES = ['ISSUED', 'RECEIVED'] as const
const CHEQUE_STATUSES = ['PENDING', 'CLEARED', 'BOUNCED', 'CANCELLED', 'RETURNED'] as const
const UPDATABLE_STATUSES = ['CLEARED', 'BOUNCED', 'CANCELLED', 'RETURNED'] as const

// === Create ===

export const createChequeSchema = z.object({
  type: z.enum(CHEQUE_TYPES),
  chequeNumber: z.string().min(1).max(50),
  bankAccountId: z.string().min(1),
  partyId: z.string().optional(),
  amount: z.number().int().min(1),
  date: z.coerce.date({ message: 'date must be a valid date' }),
  notes: z.string().optional(),
})

export type CreateChequeInput = z.infer<typeof createChequeSchema>

// === Update Status ===

export const updateChequeStatusSchema = z.object({
  status: z.enum(UPDATABLE_STATUSES),
  clearanceDate: z.coerce.date().optional(),
  bounceCharges: z.number().int().min(0).optional(),
  bounceReason: z.string().max(500).optional(),
})

export type UpdateChequeStatusInput = z.infer<typeof updateChequeStatusSchema>

// === List ===

export const listChequesSchema = z.object({
  type: z.enum(CHEQUE_TYPES).optional(),
  status: z.enum(CHEQUE_STATUSES).optional(),
  bankAccountId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListChequesQuery = z.infer<typeof listChequesSchema>
