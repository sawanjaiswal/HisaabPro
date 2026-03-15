/**
 * Dashboard & Reports Zod Schemas
 */

import { z } from 'zod'

const DASHBOARD_RANGES = ['today', 'this_week', 'this_month', 'custom'] as const
const REPORT_GROUP_BY = ['none', 'day', 'week', 'month', 'party', 'product', 'category'] as const
const REPORT_SORT_BY = ['date_asc', 'date_desc', 'amount_asc', 'amount_desc'] as const
const INVOICE_REPORT_TYPES = ['sale', 'purchase'] as const
const INVOICE_REPORT_STATUS = ['paid', 'unpaid', 'partial'] as const
const STOCK_STATUS = ['in_stock', 'low', 'out_of_stock'] as const
const STOCK_SORT = ['name_asc', 'name_desc', 'stock_asc', 'stock_desc', 'value_asc', 'value_desc'] as const
const DAY_BOOK_TYPES = ['sale', 'purchase', 'payment_in', 'payment_out', 'expense', 'stock_adjustment'] as const
const PAYMENT_HISTORY_TYPES = ['in', 'out'] as const
const PAYMENT_HISTORY_GROUP = ['none', 'day', 'party', 'mode'] as const

// === Dashboard ===

export const dashboardStatsSchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('today'),
  from: z.string().optional(),
  to: z.string().optional(),
})

// === Invoice Report ===

export const invoiceReportSchema = z.object({
  type: z.enum(INVOICE_REPORT_TYPES),
  from: z.string().optional(),
  to: z.string().optional(),
  partyId: z.string().optional(),
  productId: z.string().optional(),
  status: z.enum(INVOICE_REPORT_STATUS).optional(),
  groupBy: z.enum(REPORT_GROUP_BY).default('none'),
  sortBy: z.enum(REPORT_SORT_BY).default('date_desc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Party Statement ===

export const partyStatementSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// === Stock Summary ===

export const stockSummarySchema = z.object({
  categoryId: z.string().optional(),
  stockStatus: z.enum(STOCK_STATUS).optional(),
  search: z.string().optional(),
  sortBy: z.enum(STOCK_SORT).default('name_asc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Day Book ===

export const dayBookSchema = z.object({
  date: z.string().default(() => new Date().toISOString().split('T')[0]),
  type: z.enum(DAY_BOOK_TYPES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// === Payment History ===

export const paymentHistorySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  partyId: z.string().optional(),
  mode: z.string().optional(),
  type: z.enum(PAYMENT_HISTORY_TYPES).optional(),
  groupBy: z.enum(PAYMENT_HISTORY_GROUP).default('none'),
  sortBy: z.enum(REPORT_SORT_BY).default('date_desc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Inferred types ===

export type DashboardStatsQuery = z.infer<typeof dashboardStatsSchema>
export type InvoiceReportQuery = z.infer<typeof invoiceReportSchema>
export type PartyStatementQuery = z.infer<typeof partyStatementSchema>
export type StockSummaryQuery = z.infer<typeof stockSummarySchema>
export type DayBookQuery = z.infer<typeof dayBookSchema>
export type PaymentHistoryQuery = z.infer<typeof paymentHistorySchema>
