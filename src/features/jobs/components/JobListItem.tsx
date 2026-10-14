/** JobListItem — one row: status pill + title + party + Rs total + scheduled date */

import { Calendar, User } from 'lucide-react'
import { JobStatusPill } from './JobStatusPill'
import { formatPaise, formatJobNumber } from '../jobs.utils'
import type { JobListRow } from '../jobs.types'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface JobListItemProps {
  job: JobListRow
  onClick: (id: string) => void
}

export function JobListItem({ job, onClick }: JobListItemProps) {
  const { t } = useLanguage()
  const scheduled = job.scheduledAt
    ? new Date(job.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  return (
    <Button
      variant="none"
      type="button"
      className="job-list-item flex flex-col gap-1 w-full text-left p-3 px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] min-h-[44px]"
      onClick={() => onClick(job.id)}
      aria-label={`${t.jobRowAriaPrefix} ${formatJobNumber(job.jobNumber, job.id)}: ${job.title}`}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-[var(--color-text-secondary)] font-medium">
          {formatJobNumber(job.jobNumber, job.id)}
        </span>
        <JobStatusPill status={job.status} />
      </div>

      <span className="text-sm font-semibold text-[var(--color-text)] leading-snug">
        {job.title}
      </span>

      <div className="flex items-center justify-between gap-2 flex-wrap w-full">
        <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
          <User size={12} aria-hidden="true" />
          {job.partyName}
        </span>

        <div className="flex items-center gap-3">
          {scheduled && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Calendar size={12} aria-hidden="true" />
              {scheduled}
            </span>
          )}
          <span className="text-sm font-bold text-[var(--color-text)]">
            ₹{formatPaise(job.totalPaise)}
          </span>
        </div>
      </div>
    </Button>
  )
}
