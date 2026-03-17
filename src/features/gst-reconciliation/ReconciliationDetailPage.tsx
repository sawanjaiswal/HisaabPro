/** ReconciliationDetailPage
 *
 * Summary cards + filter pills (All/Matched/Mismatched/Missing/Extra) + entry list.
 * Two independent load states: summary and entries.
 */

import { useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useReconciliationDetail } from './useReconciliationDetail'
import { ReconciliationSummaryCards } from './components/ReconciliationSummaryCards'
import { ReconciliationEntryCard } from './components/ReconciliationEntryCard'
import { MATCH_STATUS_FILTER_OPTIONS } from './reconciliation.constants'
import type { MatchStatus } from './reconciliation.types'
import './reconciliation.css'

export default function ReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const {
    summary, entries,
    summaryStatus, entriesStatus,
    matchFilter, setMatchFilter,
    entriesTotal, hasMoreEntries, loadMoreEntries,
    refresh,
  } = useReconciliationDetail(id ?? '')

  const title = summary ? `${summary.period} Reconciliation` : 'Reconciliation'

  if (summaryStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Reconciliation" backTo={ROUTES.GST_RECONCILIATION} />
        <PageContainer>
          <div className="recon-detail-skeleton">
            <div className="recon-detail-skeleton__cards" aria-hidden="true" />
            <div className="recon-detail-skeleton__entries" aria-hidden="true" />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (summaryStatus === 'error' || !summary) {
    return (
      <AppShell>
        <Header title="Reconciliation" backTo={ROUTES.GST_RECONCILIATION} />
        <PageContainer>
          <ErrorState
            title="Could not load reconciliation"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.GST_RECONCILIATION} />
      <PageContainer>

        {/* Summary metric cards */}
        <ReconciliationSummaryCards summary={summary} />

        {/* Filter pills */}
        <div className="recon-filter-pills" role="tablist" aria-label="Filter by match status">
          {MATCH_STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={matchFilter === value}
              className={`recon-filter-pill${matchFilter === value ? ' recon-filter-pill--active' : ''}`}
              onClick={() => setMatchFilter(value as MatchStatus | 'ALL')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Entries loading */}
        {entriesStatus === 'loading' && entries.length === 0 && (
          <div className="recon-entries-skeleton" aria-label="Loading entries" aria-busy="true">
            {[1, 2, 3].map((n) => <div key={n} className="recon-entry-skeleton-item" aria-hidden="true" />)}
          </div>
        )}

        {/* Entries error */}
        {entriesStatus === 'error' && (
          <ErrorState
            title="Could not load entries"
            message="Try again or change the filter."
            onRetry={refresh}
          />
        )}

        {/* Empty state */}
        {entriesStatus === 'success' && entries.length === 0 && (
          <div className="recon-empty">
            <div className="recon-empty__icon" aria-hidden="true"><FileText size={28} /></div>
            <p className="recon-empty__title">No entries found</p>
            <p className="recon-empty__desc">
              {matchFilter === 'ALL'
                ? 'This reconciliation has no entries.'
                : `No ${matchFilter.toLowerCase().replace(/_/g, ' ')} entries.`}
            </p>
          </div>
        )}

        {/* Entry list */}
        {entries.length > 0 && (
          <>
            <p className="recon-entry-count">
              {entriesTotal} {entriesTotal === 1 ? 'entry' : 'entries'}
            </p>
            <div className="recon-entry-list">
              {entries.map((entry) => (
                <ReconciliationEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
            {hasMoreEntries && (
              <button type="button" className="recon-load-more" onClick={loadMoreEntries}>
                Load more
              </button>
            )}
          </>
        )}

      </PageContainer>
    </AppShell>
  )
}
