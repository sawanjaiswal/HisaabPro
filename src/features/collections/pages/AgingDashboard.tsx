/**
 * AgingDashboard — Collections Hub main screen.
 *
 * 4 UI states: loading skeleton · error banner · empty (no receivables) · success.
 * Pull-to-refresh via query invalidation on scroll-to-top gesture.
 */

import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
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

  // Loading state
  if (status === 'pending') {
    return (
      <AppShell>
        <Header title={t.agingDashboard ?? 'Aging Dashboard'} />
        <PageContainer>
          <AgingLoadingSkeleton />
        </PageContainer>
      </AppShell>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.agingDashboard ?? 'Aging Dashboard'} />
        <PageContainer>
          <ErrorState
            title={t.agingError ?? 'Could not load aging data'}
            onRetry={() => refetch()}
            retryLabel={t.agingRetry ?? 'Retry'}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const { summary, topOutstanding, brokenPtps } = data

  // Empty state — total receivable is 0
  if (summary.totalReceivable === 0) {
    return (
      <AppShell>
        <Header
          title={t.agingDashboard ?? 'Aging Dashboard'}
          actions={
            <button
              type="button"
              onClick={handleRefresh}
              aria-label={t.agingRefreshing ?? 'Refresh'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, color: 'var(--color-gray-600)' }}
            >
              <RefreshCw size={18} />
            </button>
          }
        />
        <PageContainer>
          <div className="aging-empty">
            <CheckCircle2 size={56} className="aging-empty__icon" aria-hidden="true" />
            <h2 className="aging-empty__title">{t.allCaughtUp ?? 'All caught up!'}</h2>
            <p className="aging-empty__desc">{t.allCaughtUpDesc ?? 'No outstanding receivables. Great work!'}</p>
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // Success state
  return (
    <AppShell>
      <Header
        title={t.agingDashboard ?? 'Aging Dashboard'}
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            aria-label={t.agingRefreshing ?? 'Refresh'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, color: 'var(--color-gray-600)' }}
          >
            <RefreshCw size={18} />
          </button>
        }
      />
      <PageContainer>
        {isStale && (
          <div className="aging-stale-banner" role="status">
            {t.agingStaleData ?? 'Showing cached data'}
          </div>
        )}

        {/* Total receivable strip */}
        <div className="aging-strip">
          <p className="aging-strip__label">{t.totalReceivable ?? 'Total Receivable'}</p>
          <p className="aging-strip__amount">{formatPaise(summary.totalReceivable)}</p>
        </div>

        {/* 2×2 bucket grid */}
        <div className="aging-grid" role="list" aria-label="Aging buckets">
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

        {/* Broken PTP alert */}
        <BrokenPtpAlert
          count={brokenPtps}
          label={t.brokenPtps ?? 'Broken Promises'}
          singleLabel={t.brokenPtp ?? 'Broken Promise'}
        />

        {/* Top 5 outstanding parties */}
        <TopPartiesList
          parties={topOutstanding}
          sectionTitle={t.topOutstanding ?? 'Top Outstanding'}
        />
      </PageContainer>
    </AppShell>
  )
}
