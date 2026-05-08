/** Production Run — constants */

export const PR_PAGE_LIMIT = 20

export const PR_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const PR_STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: 'badge badge--warning',
  COMPLETED: 'badge badge--success',
  CANCELLED: 'badge badge--error',
}

export const WIZARD_STEPS = ['Choose Recipe', 'Quantity & Date', 'Review Components', 'Confirm Run'] as const
