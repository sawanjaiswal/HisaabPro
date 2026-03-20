import { STATUS_LABELS } from '../serial-number.constants'
import { getStatusBadgeStyle } from '../serial-number.utils'
import type { SerialStatus } from '../serial-number.types'

interface SerialStatusBadgeProps {
  status: SerialStatus
}

export function SerialStatusBadge({ status }: SerialStatusBadgeProps) {
  const style = getStatusBadgeStyle(status)

  return (
    <span
      className="serial-status-badge"
      style={{ background: style.background, color: style.color }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
