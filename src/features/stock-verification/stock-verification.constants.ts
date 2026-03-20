import type { VerificationStatus } from './stock-verification.types'

export const VERIFICATION_PAGE_SIZE = 20

export const NOTES_MAX = 500

export const STATUS_LABELS: Record<VerificationStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
}

export const STATUS_COLORS: Record<VerificationStatus, { bg: string; text: string; icon: string }> = {
  DRAFT: {
    bg: 'var(--color-gray-100)',
    text: 'var(--color-gray-600)',
    icon: 'var(--color-gray-400)',
  },
  IN_PROGRESS: {
    bg: 'var(--color-warning-bg-subtle)',
    text: 'var(--color-warning-700)',
    icon: 'var(--color-warning-500)',
  },
  COMPLETED: {
    bg: 'var(--color-success-bg-subtle)',
    text: 'var(--color-success-700)',
    icon: 'var(--color-success-500)',
  },
}

export const DISCREPANCY_THRESHOLD = 0
