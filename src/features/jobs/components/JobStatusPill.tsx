/** JobStatusPill — colour-coded status chip */

import type { JobStatus } from '../jobs.types'
import { STATUS_COLOUR } from '../jobs.constants'

const STATUS_LABELS: Record<JobStatus, string> = {
  QUOTED:      'Quoted',
  SCHEDULED:   'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  INVOICED:    'Invoiced',
  CANCELLED:   'Cancelled',
}

interface JobStatusPillProps {
  status: JobStatus
  size?: 'sm' | 'md'
}

export function JobStatusPill({ status, size = 'sm' }: JobStatusPillProps) {
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
