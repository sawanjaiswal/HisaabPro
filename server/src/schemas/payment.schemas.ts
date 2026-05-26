/**
 * Payment Zod Schemas — validation for payment, outstanding, reminder endpoints
 *
 * All schemas validate req.body directly (flat, no `body:` wrapper).
 */

import { z } from 'zod'
import {
  PAYMENT_TYPES,
  CUSTOMER_PAYMENT_TYPES,
  PAYMENT_MODES,
  PAYMENT_DISCOUNT_TYPES as DISCOUNT_TYPES,
  PAYMENT_SORT_BY as SORT_BY,
  SORT_ORDER,
  OUTSTANDING_TYPES,
  OUTSTANDING_SORT_BY as OUTSTANDING_SORT,
  REMINDER_CHANNELS,
} from '../../../shared/enums.js'

// === Payment type — public vs internal split (Phase 6 S7 + M8 closures) ===
//
// PaymentTypePublic is used by POST /api/payments (customer-facing endpoint):
// only PAYMENT_IN / PAYMENT_OUT are accepted. PaymentTypeInternal is used by
// the payroll-service's internal `prisma.payment.create` calls: the full
// widened set (incl. PAYROLL_OUT / PAYROLL_IN). See architecture §2.2.

/** Public surface — POST /api/payments accepts only customer payment types. */
export const PaymentTypePublic = z.enum(CUSTOMER_PAYMENT_TYPES)

/** Internal surface — payroll-service writes use the widened enum. */
export const PaymentTypeInternal = z.enum(PAYMENT_TYPES)

// === Payment CRUD ===

const allocationSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().int().positive(),
}).strict()

const discountSchema = z.object({
  type: z.enum(DISCOUNT_TYPES),
  value: z.number().positive(),
  reason: z.string().max(200).optional(),
}).strict()

export const createPaymentSchema = z.object({
  // Public endpoint — payroll types (PAYROLL_OUT/IN) are written ONLY by the
  // payroll-service via prisma.payment.create direct. M8 single-rejection-path:
  // Zod rejects with 400 INVALID_INPUT here; downstream handlers double-defend
  // via `assertCustomerPaymentType` which throws 400 INVALID_PAYMENT_TYPE.
  type: PaymentTypePublic,
  partyId: z.string().min(1),
  amount: z.number().int().min(1).max(9_999_999_900),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(PAYMENT_MODES),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  allocations: z.array(allocationSchema).max(50).default([]),
  discount: discountSchema.optional(),
  offlineId: z.string().optional(),
}).strict()

export const updatePaymentSchema = z.object({
  amount: z.number().int().min(1).max(9_999_999_900).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  referenceNumber: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
}).strict()

export const listPaymentsSchema = z.object({
  type: z.enum(PAYMENT_TYPES).optional(),
  partyId: z.string().optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  // Phase 7 · 7.1D PR-D4 — filter by ImportJob provenance. Always
  // composed with the businessId clause downstream so a cross-tenant
  // importJobId returns an empty array (never another business's rows).
  importJobId: z.string().min(1).optional(),
  sortBy: z.enum(SORT_BY).default('date'),
  sortOrder: z.enum(SORT_ORDER).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

// === Allocations ===

export const updateAllocationsSchema = z.object({
  allocations: z.array(allocationSchema).max(50),
}).strict()

// === Outstanding ===

export const listOutstandingSchema = z.object({
  type: z.enum(OUTSTANDING_TYPES).default('ALL'),
  overdue: z.coerce.boolean().default(false),
  search: z.string().optional(),
  sortBy: z.enum(OUTSTANDING_SORT).default('amount'),
  sortOrder: z.enum(SORT_ORDER).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

// === Reminders ===

export const sendReminderSchema = z.object({
  partyId: z.string().min(1),
  invoiceId: z.string().optional(),
  channel: z.enum(REMINDER_CHANNELS),
  message: z.string().max(1000).optional(),
}).strict()

export const sendBulkRemindersSchema = z.object({
  partyIds: z.array(z.string().min(1)).min(1).max(50),
  channel: z.enum(REMINDER_CHANNELS),
  message: z.string().max(1000).optional(),
}).strict()

export const listRemindersSchema = z.object({
  partyId: z.string().optional(),
  invoiceId: z.string().optional(),
  status: z.string().optional(),
  channel: z.enum(REMINDER_CHANNELS).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

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
}).strict()

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
