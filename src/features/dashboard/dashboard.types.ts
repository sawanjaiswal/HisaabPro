/** Dashboard — Type definitions
 *
 * All amount fields are in PAISE (integer).
 * Display via formatAmount() from dashboard.utils.ts.
 */

import type { TranslationKey } from '@/lib/translations'

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
  trend: DashboardTrend
  alerts: {
    lowStockCount: number
    overdueInvoiceCount: number
    overdueAmount: number
  }
  topDebtors: TopDebtor[]
}

// ─── Trend (hero chart, metric tiles, overview carousel) ─────────────────────

/** Mirror of the server's TrendMetric (services/dashboard/trend.ts). */
export interface TrendMetric {
  /** Window total in paise. */
  total: number
  /** Previous window's total in paise — what deltaPct compares against. */
  previousTotal: number
  /** Percent change vs the previous window; null when there is no basis. */
  deltaPct: number | null
  /** One point per day of the window, oldest first (paise). */
  series: number[]
}

export interface DashboardTrend {
  days: number
  sales: TrendMetric
  collections: TrendMetric
  expenses: TrendMetric
  cashInHand: number
  todayVsYesterday: { today: number; yesterday: number; deltaPct: number | null }
}

/** A tile on the dark hero. Amounts in paise. */
export interface MetricTile {
  id: string
  labelKey: TranslationKey
  /** Lucide icon name */
  icon: string
  amount: number
  /** null → render the status pill instead of a delta chip */
  deltaPct: number | null
  statusKey?: TranslationKey
  tone: 'teal' | 'coral' | 'success'
  /** Kept in the data but behind the "show more" reveal. */
  hidden?: boolean
}

/** A card in the business-overview carousel. Amounts in paise. */
export interface OverviewCard {
  id: string
  labelKey: TranslationKey
  amount: number
  deltaPct: number | null
  series: number[]
  /** Whether an increase is good news for this metric. */
  positive: boolean
}

export type ActivityType ='sale_invoice' | 'purchase_invoice' | 'payment_in' | 'payment_out'

export interface RecentActivityItem {
  id: string
  type: ActivityType
  partyId: string
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

// ─── Top priorities card (derived from existing data, no new API fields) ─────

export type PriorityTone = 'warning' | 'danger' | 'info' | 'success'

export interface PriorityItem {
  id: string
  tone: PriorityTone
  /** Lucide icon name */
  icon: string
  /** Literal display text (e.g. a party name) — takes priority over titleKey */
  title?: string
  /** Translation key — used when title is a generic label, not raw data */
  titleKey?: TranslationKey
  subtitle: string
  actionLabelKey: TranslationKey
  actionRoute: string
}

// ─── Quick action pill config ────────────────────────────────────────────────

export interface QuickAction {
  id: string
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
