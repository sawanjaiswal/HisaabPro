/** Recurring Invoices — Constants
 *
 * Single source of truth for labels, badge variants, and filter options.
 * All magic strings live here — never inline.
 */

import type { RecurringFrequency, RecurringStatus } from './recurring.types'

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

export const STATUS_LABELS: Record<RecurringStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
}

/** Maps status to Badge variant for visual consistency */
export const STATUS_BADGE_VARIANTS: Record<RecurringStatus, 'paid' | 'pending' | 'draft'> = {
  ACTIVE: 'paid',
  PAUSED: 'pending',
  COMPLETED: 'draft',
}

export const RECURRING_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
] as const

export const RECURRING_PAGE_LIMIT = 20
