/** DeliveryStatusBadge — per-recipient dispatch status */

import type { RecipientDispatchStatus } from '../marketing.types'

interface Props {
  status: RecipientDispatchStatus
  skipReason?: string | null
}

const BADGE_MAP: Record<RecipientDispatchStatus, { label: string; className: string }> = {
  QUEUED:  { label: 'Queued',  className: 'badge badge--neutral' },
  SENT:    { label: 'Sent',    className: 'badge badge--success' },
  FAILED:  { label: 'Failed',  className: 'badge badge--error' },
  SKIPPED: { label: 'Skipped', className: 'badge badge--warning' },
}

export function DeliveryStatusBadge({ status, skipReason }: Props) {
  const { label, className } = BADGE_MAP[status]
  const title = skipReason ? `Skipped: ${skipReason}` : undefined

  return (
    <span className={className} title={title} aria-label={`Delivery status: ${label}${skipReason ? ` (${skipReason})` : ''}`}>
      {label}
    </span>
  )
}
