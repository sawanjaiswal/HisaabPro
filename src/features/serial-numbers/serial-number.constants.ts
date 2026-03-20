import type { SerialStatus } from './serial-number.types'

export const SERIAL_PAGE_SIZE = 20
export const SERIAL_NUMBER_MAX = 100
export const NOTES_MAX = 500
export const BULK_CREATE_MAX = 200

export const STATUS_LABELS: Record<SerialStatus, string> = {
  AVAILABLE: 'Available',
  SOLD: 'Sold',
  RETURNED: 'Returned',
  DAMAGED: 'Damaged',
  WARRANTY: 'In Warranty',
}

export const STATUS_COLORS: Record<SerialStatus, { bg: string; text: string }> = {
  AVAILABLE: { bg: 'var(--color-success-bg-subtle)', text: 'var(--color-success-700)' },
  SOLD: { bg: 'var(--color-info-bg-subtle)', text: 'var(--color-info-700)' },
  RETURNED: { bg: 'var(--color-warning-bg-subtle)', text: 'var(--color-warning-700)' },
  DAMAGED: { bg: 'var(--color-error-bg-subtle)', text: 'var(--color-error-700)' },
  WARRANTY: { bg: 'var(--color-primary-bg-subtle)', text: 'var(--color-primary-500)' },
}

export const STATUS_FILTER_OPTIONS: Array<{ value: SerialStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'WARRANTY', label: 'In Warranty' },
]
