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
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useReconciliationDetail } from './useReconciliationDetail'
import { ReconciliationSummaryCards } from './components/ReconciliationSummaryCards'
import { ReconciliationEntryCard } from './components/ReconciliationEntryCard'
import { MATCH_STATUS_FILTER_OPTIONS } from './reconciliation.constants'
import type { MatchStatus } from './reconciliation.types'
import './reconciliation.css'

export default function ReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const {
    summary, entries,
    summaryStatus, entriesStatus,
    matchFilter, setMatchFilter,
    entriesTotal, hasMoreEntries, loadMoreEntries,
    refresh,
  } = useReconciliationDetail(id ?? '')

  const title = summary ? `${summary.period} ${t.reconciliation}` : t.reconciliation

  if (summaryStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.reconciliation} backTo={ROUTES.GST_RECONCILIATION} />
        <PageContainer className="space-y-6">
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
        <Header title={t.reconciliation} backTo={ROUTES.GST_RECONCILIATION} />
        <PageContainer className="space-y-6">
          <ErrorState
            title={t.couldNotLoadReconciliation}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.GST_RECONCILIATION} />
      <PageContainer className="space-y-6">

        {/* Summary metric cards */}
        <ReconciliationSummaryCards summary={summary} />

        {/* Filter pills */}
        <div className="recon-filter-pills stagger-filters" role="tablist" aria-label={t.filterByMatchStatus}>
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
          <div className="recon-entries-skeleton" aria-label={t.loadingEntries} aria-busy="true">
            {[1, 2, 3].map((n) => <div key={n} className="recon-entry-skeleton-item" aria-hidden="true" />)}
          </div>
        )}

        {/* Entries error */}
        {entriesStatus === 'error' && (
          <ErrorState
            title={t.couldNotLoadEntries}
            message={t.couldNotLoadEntriesMsg}
            onRetry={refresh}
          />
        )}

        {/* Empty state */}
        {entriesStatus === 'success' && entries.length === 0 && (
          <div className="recon-empty">
            <div className="recon-empty__icon" aria-hidden="true"><FileText size={28} /></div>
            <p className="recon-empty__title">{t.noEntriesFound}</p>
            <p className="recon-empty__desc">
              {matchFilter === 'ALL'
                ? t.noEntriesForRecon
                : `No ${matchFilter.toLowerCase().replace(/_/g, ' ')} ${t.entries}.`}
            </p>
          </div>
        )}

        {/* Entry list */}
        {entries.length > 0 && (
          <>
            <p className="recon-entry-count">
              {entriesTotal} {entriesTotal === 1 ? t.entry : t.entries}
            </p>
            <div className="recon-entry-list stagger-list">
              {entries.map((entry) => (
                <ReconciliationEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
            {hasMoreEntries && (
              <Button type="button" variant="secondary" size="md" className="recon-load-more" onClick={loadMoreEntries} aria-label={t.loadMore}>
                {t.loadMore}
              </Button>
            )}
          </>
        )}

      </PageContainer>
    </AppShell>
  )
}
