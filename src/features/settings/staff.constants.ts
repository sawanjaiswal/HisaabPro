import type { StaffStatus } from './settings.types'

// ─── Staff Status Labels ──────────────────────────────────────────────────────

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  ACTIVE:    'Active',
  SUSPENDED: 'Suspended',
  PENDING:   'Pending',
}

export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
  ACTIVE:    'var(--color-success-600)',
  SUSPENDED: 'var(--color-error-600)',
  PENDING:   'var(--color-warning-600)',
}
