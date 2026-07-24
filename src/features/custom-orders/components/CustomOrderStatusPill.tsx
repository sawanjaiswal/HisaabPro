/** CustomOrderStatusPill — colour-coded status chip */

import type { CustomOrderStatus } from '../custom-orders.types'
import { STATUS_COLOUR } from '../custom-orders.constants'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderStatusPillProps {
  status: CustomOrderStatus
  size?: 'sm' | 'md'
}

export function CustomOrderStatusPill({ status, size = 'sm' }: CustomOrderStatusPillProps) {
  const { t } = useLanguage()
  const STATUS_LABELS: Record<CustomOrderStatus, string> = {
    RECEIVED:      t.coStatusReceived,
    IN_PRODUCTION: t.coStatusInProduction,
    READY:         t.coStatusReady,
    DELIVERED:     t.coStatusDelivered,
    INVOICED:      t.coStatusInvoiced,
    CANCELLED:     t.coStatusCancelled,
  }
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
      aria-label={`${t.coStatusAria}: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
