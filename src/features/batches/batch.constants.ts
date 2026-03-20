/** Batch Tracking — Constants and configuration */

import type { ExpiryStatus } from './batch.types'

// ─── Pagination ──────────────────────────────────────────────────────────────

export const BATCH_PAGE_SIZE = 20

// ─── Expiry thresholds ───────────────────────────────────────────────────────

export const EXPIRY_WARNING_DAYS = 30

// ─── Field limits ────────────────────────────────────────────────────────────

export const BATCH_NUMBER_MAX = 100
export const BATCH_NOTES_MAX = 500

// ─── Expiry status → badge CSS class mapping ────────────────────────────────

export const EXPIRY_BADGE_CLASSES: Record<ExpiryStatus, string> = {
  expired:  'badge badge-overdue',
  expiring: 'badge badge-pending',
  fresh:    'badge badge-paid',
  none:     'badge badge-neutral',
}

// ─── Expiry status → human label ─────────────────────────────────────────────

export const EXPIRY_STATUS_LABELS: Record<ExpiryStatus, string> = {
  expired:  'Expired',
  expiring: 'Expiring Soon',
  fresh:    'Fresh',
  none:     'No Expiry',
}
