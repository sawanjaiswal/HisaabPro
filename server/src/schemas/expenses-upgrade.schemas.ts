/**
 * Expenses Upgrade — Zod schemas (PR3)
 * Covers: templates, budgets, confirm/skip.
 * All schemas are .strict() for exact shape matching.
 */

import { z } from 'zod'

const FREQUENCY = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 'OTHER'] as const

// ── Helpers ────────────────────────────────────────────────────────────────

/** YYYY-MM-01 pattern used for monthYmd in ExpenseBudget */
const monthYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, 'monthYmd must be YYYY-MM-01')

// ── Create Template ────────────────────────────────────────────────────────

export const createTemplateSchema = z
  .object({
    categoryId: z.string().cuid(),
    amountPaise: z.number().int().min(1, 'Amount must be at least 1 paise'),
    frequency: z.enum(FREQUENCY),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    nextRunDate: z.coerce.date(),
    paymentMode: z.enum(PAYMENT_MODES),
    partyId: z.string().cuid().optional(),
    note: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.frequency === 'MONTHLY' && v.dayOfMonth == null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'dayOfMonth required for MONTHLY frequency' })
    }
    if (v.frequency === 'WEEKLY' && v.dayOfWeek == null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfWeek'], message: 'dayOfWeek required for WEEKLY frequency' })
    }
    if (v.frequency === 'YEARLY' && v.dayOfMonth == null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'dayOfMonth required for YEARLY frequency' })
    }
  })

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>

// ── Update Template ────────────────────────────────────────────────────────

export const updateTemplateSchema = z
  .object({
    amountPaise: z.number().int().min(1).optional(),
    frequency: z.enum(FREQUENCY).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    nextRunDate: z.coerce.date().optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    partyId: z.string().cuid().optional().nullable(),
    note: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.frequency === 'MONTHLY' && v.dayOfMonth == null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'dayOfMonth required for MONTHLY frequency' })
    }
    if (v.frequency === 'WEEKLY' && v.dayOfWeek == null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfWeek'], message: 'dayOfWeek required for WEEKLY frequency' })
    }
    if (v.frequency === 'YEARLY' && v.dayOfMonth == null) {
      ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'dayOfMonth required for YEARLY frequency' })
    }
  })

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>

// ── Set Budget ─────────────────────────────────────────────────────────────

export const setBudgetSchema = z
  .object({
    categoryId: z.string().cuid().optional().nullable(),
    monthYmd: monthYmdSchema,
    amountPaise: z.number().int().min(1, 'Budget must be at least 1 paise'),
  })
  .strict()

export type SetBudgetInput = z.infer<typeof setBudgetSchema>

// ── List Budgets Query ─────────────────────────────────────────────────────

export const listBudgetsQuerySchema = z
  .object({
    monthYmd: monthYmdSchema,
  })
  .strict()

export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>

// ── Confirm Expense (empty body — validated by param only) ─────────────────

export const confirmExpenseSchema = z.object({}).strict()

export type ConfirmExpenseInput = z.infer<typeof confirmExpenseSchema>
