/** Reports — Shared types used across multiple report screens
 *
 * All monetary amounts are in PAISE (integer).
 * Display conversion: Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
 * with (paise / 100) at the component layer.
 */

// ─── Shared Report Types ──────────────────────────────────────────────────────

/** Preset date range options shown in the filter bar */
export type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_fy'
  | 'custom'

/** How report rows are grouped — used in Invoice Report and Payment History */
export type ReportGroupBy =
  | 'none'
  | 'day'
  | 'week'
  | 'month'
  | 'party'
  | 'product'
  | 'category'

/** Sort order applied to flat (non-grouped) report results */
export type ReportSortBy =
  | 'date_asc'
  | 'date_desc'
  | 'amount_asc'
  | 'amount_desc'

/** Export formats for all report types */
export type ExportFormat = 'PDF' | 'CSV'

/** Cursor-based pagination metadata returned on all list endpoints */
export interface Pagination {
  cursor: string | null
  hasMore: boolean
  total: number
}

// ─── Export ────────────────────────────────────────────────────────────────────

/** Identifier for each exportable report */
export type ExportReportType =
  | 'invoices'
  | 'party_statement'
  | 'stock_summary'
  | 'day_book'
  | 'payment_history'

/** Request body for POST /reports/export */
export interface ExportRequest {
  reportType: ExportReportType
  format: ExportFormat
  /** The same filter object used when fetching the report */
  filters: Record<string, unknown>
  options?: {
    /** Whether to include the business header at the top of the export */
    includeHeader?: boolean
    businessName?: string
    logo?: boolean
    /** Date format string, e.g. "DD/MM/YYYY" */
    dateFormat?: string
  }
}

/** Response from POST /reports/export — returns a time-limited download URL */
export interface ExportResponse {
  success: boolean
  data: {
    fileUrl: string
    fileName: string
    fileSize: number         // bytes
    expiresAt: string        // ISO datetime
  }
}

// ─── Report Hub ─────────────────────────────────────────────────────────────────

/** A single report category card shown on the Reports Hub page */
export interface ReportCategory {
  id: string
  title: string
  description: string
  /** Lucide icon component name, e.g. "TrendingUp" */
  icon: string
  /** Full path from ROUTES config */
  route: string
  /** CSS variable string for the card accent color */
  color: string
}
