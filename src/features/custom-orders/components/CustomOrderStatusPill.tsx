/** CustomOrderStatusPill — colour-coded status chip */

import type { CustomOrderStatus } from '../custom-orders.types'
import { STATUS_COLOUR } from '../custom-orders.constants'

const STATUS_LABELS: Record<CustomOrderStatus, string> = {
  RECEIVED:      'Received',
  IN_PRODUCTION: 'In Production',
  READY:         'Ready',
  DELIVERED:     'Delivered',
  INVOICED:      'Invoiced',
  CANCELLED:     'Cancelled',
}

interface CustomOrderStatusPillProps {
  status: CustomOrderStatus
  size?: 'sm' | 'md'
}

export function CustomOrderStatusPill({ status, size = 'sm' }: CustomOrderStatusPillProps) {
  const colours = STATUS_COLOUR[status]
  const fontSize = size === 'md' ? 'var(--fs-sm)' : 'var(--fs-xs)'
  const padding  = size === 'md' ? '4px 10px' : '2px 8px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '9999px',
        fontWeight: 600,
        fontSize,
        padding,
        background: colours.bg,
        color: colours.text,
        whiteSpace: 'nowrap',
      }}
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
