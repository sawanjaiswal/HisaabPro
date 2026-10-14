/** JobsListPage — /jobs: list with status filter pills + 4 UI states */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useJobs } from '../hooks/useJobs'
import { JobListItem } from '../components/JobListItem'
import { JobsListSkeleton } from '../components/JobsListSkeleton'
import { JobsEmptyState } from '../components/JobsEmptyState'
import { JobsErrorState } from '../components/JobsErrorState'
import { JOB_STATUSES, JOB_ROUTES } from '../jobs.constants'
import type { JobStatus } from '../jobs.types'
import { useLanguage } from '@/hooks/useLanguage'

const ALL = 'ALL' as const
type Filter = JobStatus | typeof ALL

export default function JobsListPage() {
  const { t } = useLanguage()
  const PILL_LABELS: Record<Filter, string> = {
    ALL: t.jobStatusAll,
    QUOTED: t.jobStatusQuoted,
    SCHEDULED: t.jobStatusScheduled,
    IN_PROGRESS: t.jobStatusInProgress,
    COMPLETED: t.jobStatusCompleted,
    INVOICED: t.jobStatusInvoiced,
    CANCELLED: t.jobStatusCancelled,
  }
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<Filter>(ALL)

  const { data, status, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useJobs(
    activeFilter === ALL ? {} : { status: activeFilter },
  )

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const goToNew = () => navigate(JOB_ROUTES.NEW)

  return (
    <AppShell>
      <Header
        title={t.jobsTitle}
        actions={
          <Button variant="ghost" size="sm" onClick={goToNew} aria-label={t.jobCreateAriaLabel}>
            <Plus size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer>
        {/* Status filter pills */}
        <div
          role="group"
          aria-label={t.jobFilterAriaLabel}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
        >
          {([ALL, ...JOB_STATUSES] as Filter[]).map((f) => (
            <Button
              key={f}
              type="button"
              variant={activeFilter === f ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              className="flex-shrink-0 rounded-full text-xs font-medium min-h-[36px] whitespace-nowrap px-3.5 py-1.5"
            >
              {PILL_LABELS[f]}
            </Button>
          ))}
        </div>

        {status === 'pending' && <JobsListSkeleton />}
        {status === 'error'   && <JobsErrorState onRetry={refetch} />}

        {status === 'success' && allItems.length === 0 && (
          <JobsEmptyState onCreateNew={goToNew} />
        )}

        {status === 'success' && allItems.length > 0 && (
          <div role="list" aria-label={t.jobsListAriaLabel} className="flex flex-col">
            {allItems.map((job) => (
              <div key={job.id} role="listitem">
                <JobListItem job={job} onClick={(id) => navigate(JOB_ROUTES.DETAIL(id))} />
              </div>
            ))}
          </div>
        )}

        {hasNextPage && (
          <Button
            type="button"
            variant="ghost" size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full mt-3 min-h-[44px]"
          >
            {isFetchingNextPage ? t.jobLoadingMore : t.jobLoadMore}
          </Button>
        )}
      </PageContainer>

    </AppShell>
  )
}
