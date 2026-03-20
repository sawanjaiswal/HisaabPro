import type { VerificationStatus } from './stock-verification.types'
import { STATUS_COLORS } from './stock-verification.constants'

export function getVerificationProgress(
  totalItems: number,
  countedItems: number
): { percentage: number; label: string } {
  if (totalItems === 0) return { percentage: 0, label: '0 of 0 counted' }
  const percentage = Math.round((countedItems / totalItems) * 100)
  return { percentage, label: `${countedItems} of ${totalItems} counted` }
}

export function getDiscrepancyColor(discrepancy: number | null): string {
  if (discrepancy === null) return 'var(--color-gray-400)'
  if (discrepancy > 0) return 'var(--color-success-600)'
  if (discrepancy < 0) return 'var(--color-error-600)'
  return 'var(--color-gray-500)'
}

export function formatDiscrepancy(qty: number | null): string {
  if (qty === null) return 'Pending'
  if (qty === 0) return 'Match'
  return qty > 0 ? `+${qty}` : `${qty}`
}

export function getStatusBadgeStyle(
  status: VerificationStatus
): { background: string; color: string } {
  const colors = STATUS_COLORS[status]
  return { background: colors.bg, color: colors.text }
}
