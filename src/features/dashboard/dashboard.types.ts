/** Dashboard — Type definitions
 *
 * All amount fields are in PAISE (integer).
 * Display via formatAmount() from dashboard.utils.ts.
 */

// ─── Home dashboard (single-call response) ───────────────────────────────────

export interface HomeDashboardData {
  outstanding: {
    receivable: { total: number; partyCount: number }
    payable: { total: number; partyCount: number }
  }
  today: {
    salesCount: number
    salesAmount: number
    paymentsReceivedCount: number
    paymentsReceivedAmount: number
    paymentsMadeAmount: number
    netCashFlow: number
  }
  recentActivity: RecentActivityItem[]
  alerts: {
    lowStockCount: number
    overdueInvoiceCount: number
    overdueAmount: number
  }
  topDebtors: TopDebtor[]
}

export type ActivityType = 'sale_invoice' | 'purchase_invoice' | 'payment_in' | 'payment_out'

export interface RecentActivityItem {
  id: string
  type: ActivityType
  partyName: string
  /** Amount in paise */
  amount: number
  /** ISO date string */
  date: string
  /** Document number or "Payment" */
  reference: string
  /** Only for invoices */
  status?: 'paid' | 'partial' | 'unpaid'
  /** Only for payments */
  mode?: string
}

export interface TopDebtor {
  partyId: string
  name: string
  phone: string
  /** Outstanding in paise */
  outstanding: number
  /** ISO date string */
  oldestDueDate: string
  daysOverdue: number
}

// ─── Quick action pill config ────────────────────────────────────────────────

export interface QuickAction {
  id: string
  label: string
  /** Lucide icon name */
  icon: string
  route: string
  /** CSS variable reference e.g. "var(--color-primary-600)" */
  color: string
}

// ─── Legacy types (kept for /stats endpoint on Reports page) ─────────────────

export type DashboardRange = 'today' | 'this_week' | 'this_month' | 'custom'

export interface DashboardStats {
  range: { from: string; to: string; label: string }
  sales: { count: number; amount: number }
  purchases: { count: number; amount: number }
  receivable: { total: number; partyCount: number }
  payable: { total: number; partyCount: number }
  topOutstandingCustomers: TopDebtor[]
  paymentsReceived: number
  paymentsMade: number
  netCashFlow: number
}

export interface DashboardFilters {
  range: DashboardRange
  from?: string
  to?: string
}
