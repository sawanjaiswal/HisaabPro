/** Dashboard — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE unless noted.
 */

import type { HomeDashboardData } from './dashboard.types'

// ─── Currency formatting ──────────────────────────────────────────────────────

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

// ─── Time formatting ──────────────────────────────────────────────────────────

/**
 * Format an ISO date as relative time: "2h ago", "3d ago"
 */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return formatDate(iso)
}

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

// ─── Name formatting ─────────────────────────────────────────────────────────

/** Extract first letter of name. Fallback: "U" */
export function getInitials(name?: string | null): string {
  if (!name) return 'U'
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

/** Extract the first word from a name for compact display */
export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

// ─── Empty state detection ────────────────────────────────────────────────────

/**
 * Returns true when the home dashboard has no meaningful data —
 * used to show first-time empty state.
 */
export function isHomeDashboardEmpty(data: HomeDashboardData): boolean {
  return (
    data.outstanding.receivable.total === 0 &&
    data.outstanding.payable.total    === 0 &&
    data.today.salesCount             === 0 &&
    data.today.paymentsReceivedCount  === 0 &&
    data.recentActivity.length        === 0
  )
}
