/** Cheques — Constants */

import type { ChequeStatus, ChequeType } from './cheque.types'

export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  PENDING:   'Pending',
  CLEARED:   'Cleared',
  BOUNCED:   'Bounced',
  CANCELLED: 'Cancelled',
}

export const CHEQUE_STATUS_COLORS: Record<ChequeStatus, string> = {
  PENDING:   'var(--color-warning-600)',
  CLEARED:   'var(--color-success-600)',
  BOUNCED:   'var(--color-error-600)',
  CANCELLED: 'var(--color-gray-500)',
}

export const CHEQUE_STATUS_BG: Record<ChequeStatus, string> = {
  PENDING:   'var(--color-warning-bg-subtle)',
  CLEARED:   'var(--color-success-bg-subtle)',
  BOUNCED:   'var(--color-error-bg-subtle)',
  CANCELLED: 'var(--color-gray-100)',
}

export const CHEQUE_TYPE_LABELS: Record<ChequeType, string> = {
  RECEIVED: 'Received',
  ISSUED:   'Issued',
}

export const CHEQUE_FILTER_OPTIONS = [
  { value: 'ALL',       label: 'All' },
  { value: 'PENDING',   label: 'Pending' },
  { value: 'CLEARED',   label: 'Cleared' },
  { value: 'BOUNCED',   label: 'Bounced' },
] as const

export const CHEQUE_PAGE_LIMIT = 20
