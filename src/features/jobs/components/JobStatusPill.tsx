/** JobStatusPill — colour-coded status chip */

import type { JobStatus } from '../jobs.types'
import { STATUS_COLOUR } from '../jobs.constants'
import { useLanguage } from '@/hooks/useLanguage'

interface JobStatusPillProps {
  status: JobStatus
  size?: 'sm' | 'md'
}

export function JobStatusPill({ status, size = 'sm' }: JobStatusPillProps) {
  const { t } = useLanguage()
  const STATUS_LABELS: Record<JobStatus, string> = {
    QUOTED:      t.jobStatusQuoted,
    SCHEDULED:   t.jobStatusScheduled,
    IN_PROGRESS: t.jobStatusInProgress,
    COMPLETED:   t.jobStatusCompleted,
    INVOICED:    t.jobStatusInvoiced,
    CANCELLED:   t.jobStatusCancelled,
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
      aria-label={`${t.jobStatusLabel}: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
