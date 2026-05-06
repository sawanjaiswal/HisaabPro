/** StatusPill — color-coded status badge for recurring schedules */

import type { RecurringStatus } from '../recurring.types'
import { STATUS_LABELS } from '../recurring.constants'

interface StatusPillProps {
  status: RecurringStatus
}

const STATUS_CLASS: Record<RecurringStatus, string> = {
  ACTIVE: 'recurring-status-pill recurring-status-pill--active',
  PAUSED: 'recurring-status-pill recurring-status-pill--paused',
  COMPLETED: 'recurring-status-pill recurring-status-pill--completed',
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span className={STATUS_CLASS[status]} aria-label={`Status: ${STATUS_LABELS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
