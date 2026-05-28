/** Jobs — Utility functions */

import { STATUS_TRANSITIONS } from './jobs.constants'
import type { JobStatus, JobItem } from './jobs.types'

/** Format a jobNumber or fallback to a short id hint. */
export function formatJobNumber(jobNumber: string | null, id: string): string {
  if (jobNumber) return jobNumber
  return `#${id.slice(-6).toUpperCase()}`
}

/** Returns allowed next statuses from the given current status. */
export function getNextStatuses(current: JobStatus): readonly JobStatus[] {
  return STATUS_TRANSITIONS[current] ?? []
}

/** Returns true if transitioning from → to is valid. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/** Compute totals from a list of job items (all values in paise). */
export function totalsFromItems(items: Array<{ ratePaise: number; quantity: string; discountPaise: number }>): {
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
} {
  let subtotal = 0
  let discount = 0
  for (const item of items) {
    const qty = parseFloat(item.quantity) || 0
    const lineTotal = Math.round(qty * item.ratePaise)
    subtotal += lineTotal
    discount += item.discountPaise
  }
  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    totalPaise: Math.max(0, subtotal - discount),
  }
}

/** Format paise as Indian rupee string (e.g. 1,00,000.00). */
export function formatPaise(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Compute line-level total from a job item. */
export function itemTotal(item: Pick<JobItem, 'ratePaise' | 'quantity' | 'discountPaise'>): number {
  const qty = parseFloat(item.quantity) || 0
  return Math.max(0, Math.round(qty * item.ratePaise) - item.discountPaise)
}

/**
 * Sub-label for an HOURLY line, e.g. "2.5h @ ₹500/hr". Returns null for ITEM
 * lines (no money math here — quantity is hours, ratePaise is rate-per-hour).
 */
export function hourlyLineLabel(
  item: Pick<JobItem, 'kind' | 'quantity' | 'ratePaise'>
): string | null {
  if (item.kind !== 'HOURLY') return null
  const hours = parseFloat(item.quantity) || 0
  return `${hours}h @ ₹${formatPaise(item.ratePaise)}/hr`
}
