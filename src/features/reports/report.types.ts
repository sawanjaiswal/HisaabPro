/** Reports — TypeScript types and interfaces
 *
 * Single source of truth for all 6 report screens:
 *   1. Reports Hub
 *   2. Sale/Purchase Invoice Report
 *   3. Party Statement
 *   4. Stock Summary
 *   5. Day Book
 *   6. Payment History
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
export type ExportFormat = 'pdf' | 'xlsx' | 'csv'

/** Cursor-based pagination metadata returned on all list endpoints */
export interface Pagination {
  cursor: string | null
  hasMore: boolean
  total: number
}

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

// ─── Party Statement ───────────────────────────────────────────────────────────

/** Every possible transaction type that can appear in a party statement */
export type StatementTransactionType =
  | 'sale_invoice'
  | 'purchase_invoice'
  | 'payment_received'
  | 'payment_made'
  | 'credit_note'
  | 'debit_note'
  | 'opening_balance'

/** A single ledger row in the party statement */
export interface StatementTransaction {
  id: string
  date: string               // ISO date
  type: StatementTransactionType
  /** Human-readable document number or reference, e.g. "SI-0042" */
  reference: string
  /** ID of the source document (invoice, payment, etc.) */
  referenceId: string
  description: string
  debit: number              // paise — amount owed by party (receivable side)
  credit: number             // paise — amount owed to party (payable side)
  runningBalance: number     // paise — positive = receivable, negative = payable
}

/** Full data payload for a party statement */
export interface PartyStatementData {
  party: {
    id: string
    name: string
    phone: string
    type: 'customer' | 'supplier'
  }
  openingBalance: {
    amount: number           // paise
    type: 'receivable' | 'payable'
    asOfDate: string         // ISO date
  }
  closingBalance: {
    amount: number           // paise
    type: 'receivable' | 'payable'
    asOfDate: string         // ISO date
  }
  transactions: StatementTransaction[]
  totals: {
    totalDebit: number       // paise
    totalCredit: number      // paise
  }
}

/** Full response shape from GET /reports/party-statement/:partyId */
export interface PartyStatementResponse {
  success: boolean
  data: PartyStatementData
  meta: Pagination
}

/** Query parameters for the party statement endpoint */
export interface PartyStatementFilters {
  from?: string              // ISO date
  to?: string                // ISO date
  cursor?: string
  limit: number
}

// ─── Stock Summary Report ──────────────────────────────────────────────────────

/** Stock level classification per product */
export type StockStatus = 'in_stock' | 'low' | 'out_of_stock'

/** Sort options for the stock summary list */
export type StockSortBy =
  | 'name_asc'
  | 'name_desc'
  | 'stock_asc'
  | 'stock_desc'
  | 'value_asc'
  | 'value_desc'

/** Query parameters for the stock summary endpoint */
export interface StockSummaryFilters {
  categoryId?: string
  stockStatus?: StockStatus
  search?: string
  sortBy: StockSortBy
  cursor?: string
  limit: number
}

/** Aggregate stats shown in the summary bar */
export interface StockSummaryStats {
  totalProducts: number
  totalStockValueAtPurchase: number  // paise
  totalStockValueAtSale: number      // paise
  lowStockCount: number
  outOfStockCount: number
}

/** A single product row in the stock summary */
export interface StockSummaryItem {
  productId: string
  name: string
  category: string
  unit: string
  currentStock: number
  minStockLevel: number
  purchasePrice: number              // paise — per unit
  salePrice: number                  // paise — per unit
  stockValueAtPurchase: number       // paise — currentStock * purchasePrice
  stockValueAtSale: number           // paise — currentStock * salePrice
  stockStatus: StockStatus
}

/** Full response shape from GET /reports/stock-summary */
export interface StockSummaryResponse {
  success: boolean
  data: {
    summary: StockSummaryStats
    items: StockSummaryItem[]
  }
  meta: Pagination
}

// ─── Day Book ──────────────────────────────────────────────────────────────────

/** All transaction types that appear in the day book */
export type DayBookTransactionType =
  | 'sale'
  | 'purchase'
  | 'payment_in'
  | 'payment_out'
  | 'expense'
  | 'stock_adjustment'

/** Query parameters for the day book endpoint */
export interface DayBookFilters {
  date: string               // ISO date, e.g. "2026-03-15"
  type?: DayBookTransactionType
  cursor?: string
  limit: number
}

/** Aggregate totals for each transaction type on the selected day */
export interface DayBookSummary {
  totalSales: { count: number; amount: number }        // paise
  totalPurchases: { count: number; amount: number }    // paise
  paymentsIn: { count: number; amount: number }        // paise
  paymentsOut: { count: number; amount: number }       // paise
  expenses: { count: number; amount: number }          // paise
  stockAdjustments: { count: number; amount: number }  // paise (can be negative)
  netCashFlow: number                                  // paise
}

/** A single transaction entry in the day book */
export interface DayBookTransaction {
  id: string
  time: string               // "HH:MM" in local time
  type: DayBookTransactionType
  description: string
  reference: string          // Document number or reference string
  referenceId: string        // Source document ID
  partyName: string
  amount: number             // paise
  /** Populated for payment_in / payment_out only */
  mode?: string
}

/** Full response shape from GET /reports/day-book */
export interface DayBookResponse {
  success: boolean
  data: {
    date: string             // ISO date
    dayLabel: string         // "Saturday, 15 March 2026"
    summary: DayBookSummary
    transactions: DayBookTransaction[]
    navigation: {
      prevDate: string | null  // ISO date or null if no history
      nextDate: string | null  // ISO date or null if date is today/future
    }
  }
  meta: Pagination
}

// ─── Payment History Report ────────────────────────────────────────────────────

/** Direction of payment flow */
export type PaymentHistoryType = 'in' | 'out'

/** Mode of payment */
export type PaymentHistoryMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque'

/** Grouping options specific to payment history */
export type PaymentHistoryGroupBy = 'none' | 'day' | 'party' | 'mode'

/** Query parameters for the payment history endpoint */
export interface PaymentHistoryFilters {
  from?: string              // ISO date
  to?: string                // ISO date
  partyId?: string
  mode?: PaymentHistoryMode
  type?: PaymentHistoryType
  groupBy: PaymentHistoryGroupBy
  sortBy: ReportSortBy
  cursor?: string
  limit: number
}

/** Aggregate totals shown in the summary bar */
export interface PaymentHistorySummary {
  totalReceived: number      // paise — sum of all 'in' payments
  totalPaid: number          // paise — sum of all 'out' payments
  net: number                // paise — totalReceived - totalPaid
  countIn: number
  countOut: number
}

/** A single payment row in the flat (ungrouped) list */
export interface PaymentHistoryItem {
  id: string
  date: string               // ISO date
  partyId: string
  partyName: string
  type: PaymentHistoryType
  mode: string
  amount: number             // paise
  reference: string
  invoiceId: string | null
  invoiceNumber: string | null
  notes: string
}

/** A collapsed group when groupBy is set to a non-'none' value */
export interface PaymentHistoryGroup {
  key: string
  label: string
  totalReceived: number      // paise
  totalPaid: number          // paise
  count: number
  items: PaymentHistoryItem[]
}

/** Full response shape from GET /reports/payments */
export interface PaymentHistoryResponse {
  success: boolean
  data: {
    summary: PaymentHistorySummary
    /** Present when groupBy is 'none' */
    items?: PaymentHistoryItem[]
    /** Present when groupBy is anything other than 'none' */
    groups?: PaymentHistoryGroup[]
  }
  meta: Pagination
}

// ─── Export ────────────────────────────────────────────────────────────────────

/** Identifier for each exportable report */
export type ExportReportType =
  | 'invoices'
  | 'party-statement'
  | 'stock-summary'
  | 'day-book'
  | 'payments'

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
