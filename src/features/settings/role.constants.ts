import type { ApprovalStatus, ApprovalType } from './settings.types'

// ─── System Roles ─────────────────────────────────────────────────────────────

export const SYSTEM_ROLE_NAMES = ['Owner', 'Manager', 'Billing Staff', 'Viewer'] as const

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number]

// ─── Approval Type Labels ─────────────────────────────────────────────────────

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  EDIT_LOCKED_TRANSACTION: 'Edit Locked Transaction',
  DELETE_TRANSACTION:      'Delete Transaction',
  PRICE_OVERRIDE:          'Price Override',
  DISCOUNT_OVERRIDE:       'Discount Override',
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING:  'Pending',
  APPROVED: 'Approved',
  DENIED:   'Denied',
  EXPIRED:  'Expired',
}

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING:  'var(--color-warning-600)',
  APPROVED: 'var(--color-success-600)',
  DENIED:   'var(--color-error-600)',
  EXPIRED:  'var(--color-neutral-400)',
}
