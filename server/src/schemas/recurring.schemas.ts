/**
 * Recurring Invoice Zod Schemas — validation for all recurring invoice endpoints
 */

import { z } from 'zod'

const FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const
const RECURRING_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'] as const

// === Create ===

export const createRecurringSchema = z.object({
  templateDocumentId: z.string().min(1),
  frequency: z.enum(FREQUENCIES),
  startDate: z.coerce.date({ message: 'startDate must be a valid date' }),
  endDate: z.coerce.date({ message: 'endDate must be a valid date' }).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  autoSend: z.boolean().optional().default(false),
})

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>

// === Update ===

export const updateRecurringSchema = z.object({
  frequency: z.enum(FREQUENCIES).optional(),
  endDate: z.coerce.date().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  autoSend: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
})

export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>

// === List (query params) ===

export const listRecurringSchema = z.object({
  status: z.enum(RECURRING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListRecurringQuery = z.infer<typeof listRecurringSchema>
