/**
 * Payment Zod Schemas — validation for payment, outstanding, reminder endpoints
 *
 * All schemas validate req.body directly (flat, no `body:` wrapper).
 */

import { z } from 'zod'
import {
  PAYMENT_TYPES,
  PAYMENT_MODES,
  PAYMENT_DISCOUNT_TYPES as DISCOUNT_TYPES,
  PAYMENT_SORT_BY as SORT_BY,
  SORT_ORDER,
  OUTSTANDING_TYPES,
  OUTSTANDING_SORT_BY as OUTSTANDING_SORT,
  REMINDER_CHANNELS,
} from '../../shared/enums.js'

// === Payment CRUD ===

const allocationSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().int().positive(),
})

const discountSchema = z.object({
  type: z.enum(DISCOUNT_TYPES),
  value: z.number().positive(),
  reason: z.string().max(200).optional(),
})

export const createPaymentSchema = z.object({
  type: z.enum(PAYMENT_TYPES),
  partyId: z.string().min(1),
  amount: z.number().int().min(1).max(9_999_999_900),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(PAYMENT_MODES),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  allocations: z.array(allocationSchema).max(50).default([]),
  discount: discountSchema.optional(),
  offlineId: z.string().optional(),
})

export const updatePaymentSchema = z.object({
  amount: z.number().int().min(1).max(9_999_999_900).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  referenceNumber: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export const listPaymentsSchema = z.object({
  type: z.enum(PAYMENT_TYPES).optional(),
  partyId: z.string().optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(SORT_BY).default('date'),
  sortOrder: z.enum(SORT_ORDER).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Allocations ===

export const updateAllocationsSchema = z.object({
  allocations: z.array(allocationSchema).max(50),
})

// === Outstanding ===

export const listOutstandingSchema = z.object({
  type: z.enum(OUTSTANDING_TYPES).default('ALL'),
  overdue: z.coerce.boolean().default(false),
  search: z.string().optional(),
  sortBy: z.enum(OUTSTANDING_SORT).default('amount'),
  sortOrder: z.enum(SORT_ORDER).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Reminders ===

export const sendReminderSchema = z.object({
  partyId: z.string().min(1),
  invoiceId: z.string().optional(),
  channel: z.enum(REMINDER_CHANNELS),
  message: z.string().max(1000).optional(),
})

export const sendBulkRemindersSchema = z.object({
  partyIds: z.array(z.string().min(1)).min(1).max(50),
  channel: z.enum(REMINDER_CHANNELS),
  message: z.string().max(1000).optional(),
})

export const listRemindersSchema = z.object({
  partyId: z.string().optional(),
  invoiceId: z.string().optional(),
  status: z.string().optional(),
  channel: z.enum(REMINDER_CHANNELS).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const updateReminderConfigSchema = z.object({
  enabled: z.boolean().optional(),
  autoRemindEnabled: z.boolean().optional(),
  frequencyDays: z.array(z.number().int().positive()).optional(),
  maxRemindersPerInvoice: z.number().int().min(1).max(20).optional(),
  defaultChannel: z.enum(REMINDER_CHANNELS).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  whatsappTemplate: z.string().max(1000).optional(),
  smsTemplate: z.string().max(1000).optional(),
})

// === Inferred types ===

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
export type ListPaymentsQuery = z.infer<typeof listPaymentsSchema>
export type UpdateAllocationsInput = z.infer<typeof updateAllocationsSchema>
export type ListOutstandingQuery = z.infer<typeof listOutstandingSchema>
export type SendReminderInput = z.infer<typeof sendReminderSchema>
export type SendBulkRemindersInput = z.infer<typeof sendBulkRemindersSchema>
export type ListRemindersQuery = z.infer<typeof listRemindersSchema>
export type UpdateReminderConfigInput = z.infer<typeof updateReminderConfigSchema>
