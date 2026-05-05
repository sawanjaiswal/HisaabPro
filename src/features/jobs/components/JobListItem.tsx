/** JobListItem — one row: status pill + title + party + Rs total + scheduled date */

import { Calendar, User } from 'lucide-react'
import { JobStatusPill } from './JobStatusPill'
import { formatPaise, formatJobNumber } from '../jobs.utils'
import type { JobListRow } from '../jobs.types'

interface JobListItemProps {
  job: JobListRow
  onClick: (id: string) => void
}

export function JobListItem({ job, onClick }: JobListItemProps) {
  const scheduled = job.scheduledAt
    ? new Date(job.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  return (
    <button
      type="button"
      className="job-list-item"
      onClick={() => onClick(job.id)}
      aria-label={`Job ${formatJobNumber(job.jobNumber, job.id)}: ${job.title}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-surface)',
        border: 'none',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {formatJobNumber(job.jobNumber, job.id)}
        </span>
        <JobStatusPill status={job.status} />
      </div>

      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
        {job.title}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
          <User size={12} aria-hidden="true" />
          {job.partyName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {scheduled && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
              <Calendar size={12} aria-hidden="true" />
              {scheduled}
            </span>
          )}
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
            ₹{formatPaise(job.totalPaise)}
          </span>
        </div>
      </div>
    </button>
  )
}
