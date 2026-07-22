/**
 * AgingDashboard — Collections Hub main screen (#22/29).
 *
 * Emerald Hero shell. One frame, one header; the body switches on query status.
 * 4 UI states: loading skeleton · error banner · empty (no receivables) · success.
 */

import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useAgingData } from '../useAgingData'
import { AgingBucketTile } from '../components/AgingBucketTile'
import { BrokenPtpAlert } from '../components/BrokenPtpAlert'
import { TopPartiesList } from '../components/TopPartiesList'
import { AgingLoadingSkeleton } from '../components/AgingLoadingSkeleton'
import { formatPaise } from '@/lib/format'
import type { AgingBucket } from '../collections.types'
import '../styles/aging.css'

const BUCKET_ORDER: AgingBucket[] = ['current', 'bucket_31', 'bucket_61', 'bucket_91']

export default function AgingDashboard() {
  const { t } = useLanguage()
  const { data, status, isStale, refetch } = useAgingData()
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['collections', 'aging'] })
  }

  const summary = status === 'success' ? data.summary : undefined
  const hasReceivables = summary !== undefined && summary.totalReceivable > 0

  const refreshAction =
    status === 'success' ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        aria-label={t.agingRefreshing ?? 'Refresh'}
      >
        <RefreshCw size={18} aria-hidden="true" />
      </Button>
    ) : undefined

  return (
    <AppShell>
      <Header title={t.agingDashboard ?? 'Aging Dashboard'} actions={refreshAction} />

      <HeroPage>
        {status === 'pending' && <AgingLoadingSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.agingError ?? 'Could not load aging data'}
            onRetry={() => refetch()}
            retryLabel={t.agingRetry ?? 'Retry'}
          />
        )}

        {status === 'success' && !hasReceivables && (
          <EmptyState
            icon={<CheckCircle2 size={22} aria-hidden="true" />}
            title={t.allCaughtUp ?? 'All paid up!'}
            description={t.allCaughtUpDesc ?? 'No overdue receivables right now. Great work!'}
          />
        )}

        {status === 'success' && hasReceivables && summary && (
          <>
            {isStale && (
              <div className="aging-stale-banner" role="status">
                {t.agingStaleData ?? 'Showing cached data'}
              </div>
            )}

            <div className="aging-strip">
              <p className="aging-strip__label">{t.totalReceivable ?? 'Total Receivable'}</p>
              <p className="aging-strip__amount">{formatPaise(summary.totalReceivable)}</p>
            </div>

            <div className="aging-grid" role="list" aria-label={t.agingBucketsLabel ?? 'Aging buckets'}>
              {BUCKET_ORDER.map((bucket) => {
                const bucketSummary = summary.buckets[bucket]
                if (!bucketSummary) return null
                return (
                  <div key={bucket} role="listitem">
                    <AgingBucketTile
                      bucket={bucket}
                      summary={bucketSummary}
                      drillDownPath={ROUTES.COLLECTIONS_BUCKET}
                      partyLabel={t.agingParty ?? 'party'}
                      partiesLabel={t.agingParties ?? 'parties'}
                    />
                  </div>
                )
              })}
            </div>

            <BrokenPtpAlert
              count={data.brokenPtps}
              label={t.brokenPtps ?? 'Broken Promises'}
              singleLabel={t.brokenPtp ?? 'Broken Promise'}
            />

            <TopPartiesList
              parties={data.topOutstanding}
              sectionTitle={t.topOutstanding ?? 'Top Outstanding'}
            />
          </>
        )}
      </HeroPage>
    </AppShell>
  )
}
