/** Dashboard — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE unless noted.
 */

import type { DashboardRange } from './dashboard.types'

// ─── Date range helpers ───────────────────────────────────────────────────────

/** Format a Date as an ISO date string (YYYY-MM-DD) */
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Return { from, to } ISO date strings for a given preset.
 * 'custom' falls back to today–today; caller must override with real values.
 */
export function getDateRangeForPreset(range: DashboardRange): { from: string; to: string } {
  const today = new Date()

  switch (range) {
    case 'today':
      return { from: toISO(today), to: toISO(today) }

    case 'this_week': {
      const day = today.getDay() // 0 = Sun, 1 = Mon, …
      const monday = new Date(today)
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      return { from: toISO(monday), to: toISO(today) }
    }

    case 'this_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toISO(firstDay), to: toISO(today) }
    }

    case 'custom':
      // Caller responsible for supplying real from/to — fallback to today
      return { from: toISO(today), to: toISO(today) }

    default: {
      const _exhaustive: never = range
      return _exhaustive
    }
  }
}

// ─── Currency formatting ──────────────────────────────────────────────────────

/** Singleton formatter — created once, reused on every call */
const INR = new Intl.NumberFormat('en-IN', {
  style:    'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a paise amount as a full rupee string with Indian numbering.
 * formatAmount(150000) → "₹1,500.00"
 */
export function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

/**
 * Format a paise amount compactly for summary cards.
 * Thresholds: Cr (≥ 1 Cr), L (≥ 1 L), K (≥ 1,000), else full format.
 *
 * formatCompactAmount(150000000) → "₹1.5Cr"
 * formatCompactAmount(1500000)   → "₹15.0L"
 * formatCompactAmount(150000)    → "₹1.5K"
 * formatCompactAmount(1500)      → "₹15.00"
 */
export function formatCompactAmount(paise: number): string {
  const rupees = paise / 100
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)}L`
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(1)}K`
  return INR.format(rupees)
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format an ISO date string for human display.
 * formatDate('2025-03-15') → "15 Mar 2025"
 */
export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

// ─── Overdue helpers ──────────────────────────────────────────────────────────

/**
 * Calculate how many full days have passed since a due date.
 * Returns 0 if the due date is today or in the future.
 *
 * calculateDaysOverdue('2025-03-01') → 14  (if today is 2025-03-15)
 */
export function calculateDaysOverdue(dueDateISO: string): number {
  const dueDate = new Date(dueDateISO)
  const today   = new Date()
  const diffMs  = today.getTime() - dueDate.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

// ─── Empty state detection ────────────────────────────────────────────────────

/**
 * Returns true when the dashboard has no meaningful data to display —
 * used to show the first-time empty state over the stats grid.
 */
export function isDashboardEmpty(stats: {
  sales:      { count: number }
  purchases:  { count: number }
  receivable: { total: number }
  payable:    { total: number }
}): boolean {
  return (
    stats.sales.count      === 0 &&
    stats.purchases.count  === 0 &&
    stats.receivable.total === 0 &&
    stats.payable.total    === 0
  )
}
