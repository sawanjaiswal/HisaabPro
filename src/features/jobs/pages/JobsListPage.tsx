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

const ALL = 'ALL' as const
type Filter = JobStatus | typeof ALL

const PILL_LABELS: Record<Filter, string> = {
  ALL: 'All',
  QUOTED: 'Quoted',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  INVOICED: 'Invoiced',
  CANCELLED: 'Cancelled',
}

export default function JobsListPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<Filter>(ALL)

  const { data, status, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useJobs(
    activeFilter === ALL ? {} : { status: activeFilter },
  )

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const goToNew = () => navigate(JOB_ROUTES.NEW)

  return (
    <AppShell>
      <Header title="Jobs" />

      <PageContainer>
        {/* Status filter pills */}
        <div
          role="group"
          aria-label="Filter jobs by status"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            overflowX: 'auto',
            paddingBottom: 'var(--space-2)',
            scrollbarWidth: 'none',
          }}
        >
          {([ALL, ...JOB_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 9999,
                border: `1px solid ${activeFilter === f ? 'var(--color-primary-600)' : 'var(--color-border)'}`,
                background: activeFilter === f ? 'var(--color-primary-600)' : 'var(--color-surface)',
                color: activeFilter === f ? '#fff' : 'var(--color-text)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: 36,
                whiteSpace: 'nowrap',
              }}
            >
              {PILL_LABELS[f]}
            </button>
          ))}
        </div>

        {status === 'pending' && <JobsListSkeleton />}
        {status === 'error'   && <JobsErrorState onRetry={refetch} />}

        {status === 'success' && allItems.length === 0 && (
          <JobsEmptyState onCreateNew={goToNew} />
        )}

        {status === 'success' && allItems.length > 0 && (
          <div role="list" aria-label="Jobs" style={{ display: 'flex', flexDirection: 'column' }}>
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
            style={{ width: '100%', marginTop: 'var(--space-3)', minHeight: 44 }}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        )}
      </PageContainer>

      <button
        type="button"
        className="fab"
        onClick={goToNew}
        aria-label="Create new job"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
