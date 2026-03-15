/** Dashboard — Type definitions
 *
 * All amount fields are in PAISE (integer).
 * Display via formatAmount() from dashboard.utils.ts.
 */

// ─── Date range ───────────────────────────────────────────────────────────────

/** Dashboard date range presets */
export type DashboardRange = 'today' | 'this_week' | 'this_month' | 'custom'

// ─── Summary stat shapes ──────────────────────────────────────────────────────

export interface DashboardSalesStats {
  /** Number of sale invoices in range */
  count: number
  /** Total invoiced amount in paise */
  amount: number
}

export interface DashboardPurchaseStats {
  /** Number of purchase invoices in range */
  count: number
  /** Total invoiced amount in paise */
  amount: number
}

export interface DashboardReceivable {
  /** Total receivable outstanding in paise */
  total: number
  /** Number of parties with outstanding */
  partyCount: number
}

export interface DashboardPayable {
  /** Total payable outstanding in paise */
  total: number
  /** Number of parties owed money to */
  partyCount: number
}

// ─── Outstanding customer ─────────────────────────────────────────────────────

export interface DashboardTopCustomer {
  partyId: string
  name: string
  phone: string
  /** Total outstanding in paise */
  outstanding: number
  /** ISO date string of oldest unpaid due date */
  oldestDueDate: string
  /** Computed days overdue from oldestDueDate */
  daysOverdue: number
}

// ─── Full stats object ────────────────────────────────────────────────────────

export interface DashboardStats {
  range: {
    /** ISO date — start of selected range */
    from: string
    /** ISO date — end of selected range */
    to: string
    /** Human-readable label e.g. "Today" */
    label: string
  }
  sales: DashboardSalesStats
  purchases: DashboardPurchaseStats
  receivable: DashboardReceivable
  payable: DashboardPayable
  /** Top N customers by outstanding amount */
  topOutstandingCustomers: DashboardTopCustomer[]
  /** Total payments received in paise during range */
  paymentsReceived: number
  /** Total payments made in paise during range */
  paymentsMade: number
  /** paymentsReceived - paymentsMade in paise */
  netCashFlow: number
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface DashboardStatsResponse {
  success: boolean
  data: DashboardStats
}

// ─── UI shapes ────────────────────────────────────────────────────────────────

/** Quick action pill config */
export interface QuickAction {
  id: string
  label: string
  /** Lucide icon name */
  icon: string
  route: string
  /** CSS variable reference e.g. "var(--color-primary-600)" */
  color: string
}

/** Dashboard filter state */
export interface DashboardFilters {
  range: DashboardRange
  /** ISO date — required when range === 'custom' */
  from?: string
  /** ISO date — required when range === 'custom' */
  to?: string
}
