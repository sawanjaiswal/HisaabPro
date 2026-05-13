/** CampaignStatusBadge — colored badge for campaign status */

import type { CampaignStatus } from '../marketing.types'
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_BADGE } from '../marketing.constants'

interface Props {
  status: CampaignStatus
}

export function CampaignStatusBadge({ status }: Props) {
  return (
    <span className={CAMPAIGN_STATUS_BADGE[status]} aria-label={`Status: ${CAMPAIGN_STATUS_LABEL[status]}`}>
      {CAMPAIGN_STATUS_LABEL[status]}
    </span>
  )
}
