/**
 * Recurring Invoice Zod Schemas — validation for all recurring invoice endpoints
 */

import { z } from 'zod'

export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const
const RECURRING_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'] as const

// === Create ===

export const createRecurringSchema = z.object({
  templateDocumentId: z.string().min(1),
  name: z.string().max(120).optional(),
  frequency: z.enum(FREQUENCIES),
  startDate: z.coerce.date({ message: 'startDate must be a valid date' }),
  endDate: z.coerce.date({ message: 'endDate must be a valid date' }).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  autoSend: z.boolean().optional().default(false),
  autoPaymentLink: z.boolean().optional().default(false),
  autoReminder: z.boolean().optional().default(false),
})

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>

// === Update ===

export const updateRecurringSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  endDate: z.coerce.date().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  autoSend: z.boolean().optional(),
  autoPaymentLink: z.boolean().optional(),
  autoReminder: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
})

export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>

// === Pause / Resume (no body required) ===

export const pauseSchema = z.object({}).strict()
export const resumeSchema = z.object({}).strict()

export type PauseInput = z.infer<typeof pauseSchema>
export type ResumeInput = z.infer<typeof resumeSchema>

// === List (query params) ===

export const listRecurringSchema = z.object({
  status: z.enum(RECURRING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListRecurringQuery = z.infer<typeof listRecurringSchema>

// === Runs list (cursor-based pagination) ===

export const runsListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type RunsListQuery = z.infer<typeof runsListSchema>
