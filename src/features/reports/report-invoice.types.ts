/** Invoice Report (Sale / Purchase) — TypeScript types
 *
 * All monetary amounts are in PAISE (integer).
 */

import type { Pagination, ReportGroupBy, ReportSortBy } from './report-shared.types'

// ─── Invoice Report (Sale / Purchase) ─────────────────────────────────────────

/** Whether the report covers sales or purchases */
export type InvoiceReportType = 'sale' | 'purchase'

/** Payment status filter for the invoice report */
export type InvoiceReportStatus = 'paid' | 'unpaid' | 'partial'

/** Query parameters for the invoice report endpoint */
export interface InvoiceReportFilters {
  type: InvoiceReportType
  from?: string              // ISO date, e.g. "2026-03-01"
  to?: string                // ISO date, e.g. "2026-03-31"
  partyId?: string
  productId?: string
  status?: InvoiceReportStatus
  groupBy: ReportGroupBy
  sortBy: ReportSortBy
  cursor?: string
  limit: number
}

/** Aggregate totals shown in the summary bar at the top of the report */
export interface InvoiceReportSummary {
  totalInvoices: number
  totalAmount: number        // paise
  totalPaid: number          // paise
  totalOutstanding: number   // paise
  totalDiscount: number      // paise
}

/** A single invoice row in the flat (ungrouped) result list */
export interface InvoiceReportItem {
  id: string
  number: string
  date: string               // ISO date
  partyId: string
  partyName: string
  itemCount: number
  amount: number             // paise — grand total
  paid: number               // paise — amount paid so far
  balance: number            // paise — amount - paid
  status: InvoiceReportStatus
}

/** A collapsed group when groupBy is set to any value other than 'none' */
export interface InvoiceReportGroup {
  key: string
  label: string
  invoiceCount: number
  totalAmount: number        // paise
  totalPaid: number          // paise
  totalOutstanding: number   // paise
  items: InvoiceReportItem[]
}

/** Full response shape from GET /reports/invoices */
export interface InvoiceReportResponse {
  success: boolean
  data: {
    summary: InvoiceReportSummary
    /** Present when groupBy is 'none' */
    items?: InvoiceReportItem[]
    /** Present when groupBy is anything other than 'none' */
    groups?: InvoiceReportGroup[]
  }
  meta: Pagination
}
