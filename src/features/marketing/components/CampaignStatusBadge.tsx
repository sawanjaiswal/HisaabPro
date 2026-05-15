/** CampaignStatusBadge — colored badge for campaign status */

import { useLanguage } from '@/hooks/useLanguage'
import type { CampaignStatus } from '../marketing.types'
import { CAMPAIGN_STATUS_BADGE } from '../marketing.constants'

interface Props {
  status: CampaignStatus
}

const STATUS_KEY: Record<CampaignStatus, 'marketingStatusDraft' | 'marketingStatusScheduled' | 'marketingStatusRunning' | 'marketingStatusCompleted' | 'marketingStatusFailed' | 'marketingStatusCancelled'> = {
  DRAFT:     'marketingStatusDraft',
  SCHEDULED: 'marketingStatusScheduled',
  RUNNING:   'marketingStatusRunning',
  COMPLETED: 'marketingStatusCompleted',
  FAILED:    'marketingStatusFailed',
  CANCELLED: 'marketingStatusCancelled',
}

export function CampaignStatusBadge({ status }: Props) {
  const { t } = useLanguage()
  const label = t[STATUS_KEY[status]]
  return (
    <span className={CAMPAIGN_STATUS_BADGE[status]} aria-label={label}>
      {label}
    </span>
  )
}
