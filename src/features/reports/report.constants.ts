/** Reports — Constants and configuration
 *
 * All label maps, color maps, default values, and report category definitions.
 * No business logic here — pure data.
 *
 * Color values reference CSS variables only — never raw hex.
 */

import { ROUTES } from '@/config/routes.config'
import type {
  DateRangePreset,
  ReportGroupBy,
  ReportSortBy,
  InvoiceReportStatus,
  StockStatus,
  StockSortBy,
  DayBookTransactionType,
  PaymentHistoryMode,
  PaymentHistoryGroupBy,
  StatementTransactionType,
  ReportCategory,
} from './report.types'

// ─── Date range labels ────────────────────────────────────────────────────────

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  today:       'Today',
  this_week:   'This Week',
  this_month:  'This Month',
  last_month:  'Last Month',
  this_fy:     'This FY',
  custom:      'Custom',
}

/** Ordered list used to render date range filter pills */
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  'today',
  'this_week',
  'this_month',
  'last_month',
  'this_fy',
  'custom',
]

// ─── Group-by labels ──────────────────────────────────────────────────────────

export const GROUP_BY_LABELS: Record<ReportGroupBy, string> = {
  none:     'No Grouping',
  day:      'By Day',
  week:     'By Week',
  month:    'By Month',
  party:    'By Party',
  product:  'By Product',
  category: 'By Category',
}

// ─── Sort-by labels ───────────────────────────────────────────────────────────

export const SORT_BY_LABELS: Record<ReportSortBy, string> = {
  date_asc:    'Date (Oldest)',
  date_desc:   'Date (Newest)',
  amount_asc:  'Amount (Low–High)',
  amount_desc: 'Amount (High–Low)',
}

// ─── Invoice report status labels & colors ────────────────────────────────────

export const INVOICE_STATUS_LABELS: Record<InvoiceReportStatus, string> = {
  paid:    'Paid',
  unpaid:  'Unpaid',
  partial: 'Partial',
}

/** CSS variable strings — used as inline style values on status badges */
export const INVOICE_STATUS_COLORS: Record<InvoiceReportStatus, string> = {
  paid:    'var(--color-success-600)',
  unpaid:  'var(--color-error-600)',
  partial: 'var(--color-warning-600)',
}

// ─── Stock status labels & colors ─────────────────────────────────────────────

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock:     'In Stock',
  low:          'Low Stock',
  out_of_stock: 'Out of Stock',
}

export const STOCK_STATUS_COLORS: Record<StockStatus, string> = {
  in_stock:     'var(--color-success-600)',
  low:          'var(--color-warning-600)',
  out_of_stock: 'var(--color-error-600)',
}

// ─── Stock sort labels ────────────────────────────────────────────────────────

export const STOCK_SORT_LABELS: Record<StockSortBy, string> = {
  name_asc:    'Name (A–Z)',
  name_desc:   'Name (Z–A)',
  stock_asc:   'Stock (Low–High)',
  stock_desc:  'Stock (High–Low)',
  value_asc:   'Value (Low–High)',
  value_desc:  'Value (High–Low)',
}

// ─── Day book transaction type labels & colors ────────────────────────────────

export const DAY_BOOK_TYPE_LABELS: Record<DayBookTransactionType, string> = {
  sale:             'Sale',
  purchase:         'Purchase',
  payment_in:       'Payment In',
  payment_out:      'Payment Out',
  expense:          'Expense',
  stock_adjustment: 'Stock Adj.',
}

export const DAY_BOOK_TYPE_COLORS: Record<DayBookTransactionType, string> = {
  sale:             'var(--color-primary-600)',
  purchase:         'var(--color-info-600)',
  payment_in:       'var(--color-success-600)',
  payment_out:      'var(--color-error-600)',
  expense:          'var(--color-warning-600)',
  stock_adjustment: 'var(--color-gray-600)',
}

// ─── Payment mode labels ──────────────────────────────────────────────────────

export const PAYMENT_MODE_LABELS: Record<PaymentHistoryMode, string> = {
  cash:          'Cash',
  upi:           'UPI',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
}

// ─── Payment history group-by labels ─────────────────────────────────────────

export const PAYMENT_GROUP_BY_LABELS: Record<PaymentHistoryGroupBy, string> = {
  none:  'No Grouping',
  day:   'By Day',
  party: 'By Party',
  mode:  'By Mode',
}

// ─── Party statement transaction type labels & colors ─────────────────────────

export const STATEMENT_TYPE_LABELS: Record<StatementTransactionType, string> = {
  sale_invoice:      'Sale Invoice',
  purchase_invoice:  'Purchase Invoice',
  payment_received:  'Payment Received',
  payment_made:      'Payment Made',
  credit_note:       'Credit Note',
  debit_note:        'Debit Note',
  opening_balance:   'Opening Balance',
}

export const STATEMENT_TYPE_COLORS: Record<StatementTransactionType, string> = {
  sale_invoice:      'var(--color-primary-600)',
  purchase_invoice:  'var(--color-info-600)',
  payment_received:  'var(--color-success-600)',
  payment_made:      'var(--color-error-600)',
  credit_note:       'var(--color-warning-600)',
  debit_note:        'var(--color-warning-600)',
  opening_balance:   'var(--color-gray-600)',
}

// ─── Report hub categories ────────────────────────────────────────────────────

/** Displayed as cards on the /reports hub page.
 *  Order here determines the visual order on screen.
 */
export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id:          'sales',
    title:       'Sales Report',
    description: 'Track all sale invoices',
    icon:        'TrendingUp',
    route:       ROUTES.REPORT_SALES,
    color:       'var(--color-primary-600)',
  },
  {
    id:          'purchases',
    title:       'Purchase Report',
    description: 'Track all purchases',
    icon:        'ShoppingCart',
    route:       ROUTES.REPORT_PURCHASES,
    color:       'var(--color-info-600)',
  },
  {
    id:          'stock',
    title:       'Stock Summary',
    description: 'Current stock levels & values',
    icon:        'Package',
    route:       ROUTES.REPORT_STOCK_SUMMARY,
    color:       'var(--color-warning-600)',
  },
  {
    id:          'daybook',
    title:       'Day Book',
    description: 'All transactions for a day',
    icon:        'Calendar',
    route:       ROUTES.REPORT_DAY_BOOK,
    color:       'var(--color-success-600)',
  },
  {
    id:          'payments',
    title:       'Payment History',
    description: 'All payments in & out',
    icon:        'Banknote',
    route:       ROUTES.REPORT_PAYMENT_HISTORY,
    color:       'var(--color-error-600)',
  },
  {
    id:          'tax_summary',
    title:       'Tax Summary',
    description: 'GST tax collected & payable',
    icon:        'Receipt',
    route:       ROUTES.REPORT_TAX_SUMMARY,
    color:       'var(--color-brand-primary)',
  },
  {
    id:          'gst_returns',
    title:       'GST Returns',
    description: 'GSTR-1, GSTR-3B, GSTR-9',
    icon:        'FileText',
    route:       ROUTES.REPORT_GST_RETURNS,
    color:       'var(--color-brand-secondary)',
  },
]

// ─── Pagination defaults ──────────────────────────────────────────────────────

/** Default page size for most report endpoints */
export const DEFAULT_PAGE_LIMIT = 20

/** Maximum page size allowed by the server */
export const MAX_PAGE_LIMIT = 100

/** Party statement uses a larger default to minimize navigating a long ledger */
export const STATEMENT_PAGE_LIMIT = 50

/** Hard cap on rows included in a single PDF export to prevent timeout */
export const MAX_PDF_EXPORT_ROWS = 10_000
