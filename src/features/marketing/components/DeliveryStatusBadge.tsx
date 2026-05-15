/** DeliveryStatusBadge — per-recipient dispatch status */

import { useLanguage } from '@/hooks/useLanguage'
import type { RecipientDispatchStatus } from '../marketing.types'

interface Props {
  status: RecipientDispatchStatus
  skipReason?: string | null
}

const CLASS_MAP: Record<RecipientDispatchStatus, string> = {
  QUEUED:  'badge badge--neutral',
  SENT:    'badge badge--success',
  FAILED:  'badge badge--error',
  SKIPPED: 'badge badge--warning',
}

const LABEL_KEY: Record<RecipientDispatchStatus, 'marketingDeliveryQueued' | 'marketingDeliverySent' | 'marketingDeliveryFailed' | 'marketingDeliverySkipped'> = {
  QUEUED:  'marketingDeliveryQueued',
  SENT:    'marketingDeliverySent',
  FAILED:  'marketingDeliveryFailed',
  SKIPPED: 'marketingDeliverySkipped',
}

export function DeliveryStatusBadge({ status, skipReason }: Props) {
  const { t } = useLanguage()
  const label = t[LABEL_KEY[status]]
  const title = skipReason ? `${t.marketingSkippedReasonPrefix}: ${skipReason}` : undefined
  const ariaLabel = `${t.marketingDeliveryStatusAria}: ${label}${skipReason ? ` (${skipReason})` : ''}`

  return (
    <span className={CLASS_MAP[status]} title={title} aria-label={ariaLabel}>
      {label}
    </span>
  )
}
