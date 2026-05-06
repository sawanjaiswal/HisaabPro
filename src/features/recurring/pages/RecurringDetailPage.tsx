/** RecurringDetailPage — schedule detail with run history and actions
 *
 * 4 UI states: loading skeleton · error · empty (0 runs) · success.
 */

import { useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useRecurring } from '../hooks/useRecurring'
import { useRecurringRuns } from '../hooks/useRecurringRuns'
import { RecurringDetailHeader } from '../components/RecurringDetailHeader'
import { RecurringActionMenu } from '../components/RecurringActionMenu'
import { RunHistoryRow } from '../components/RunHistoryRow'
import '../recurring.css'
import '../styles/recurring-detail.css'

export default function RecurringDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()

  const {
    schedule, isLoading, isError, refetch,
    pause, resume, generate, remove,
    isPausing, isResuming, isGenerating, isDeleting,
  } = useRecurring(id ?? '')

  const {
    runs, isLoading: runsLoading, isError: runsError,
    nextCursor, loadMore,
  } = useRecurringRuns(id ?? '')

  // ── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppShell>
        <Header title={t.recurringInvoices ?? 'Recurring'} backTo={ROUTES.RECURRING} />
        <PageContainer>
          <div className="recurring-skeleton" aria-busy="true" aria-label="Loading schedule">
            <div className="recurring-skeleton__card" style={{ height: 120 }} />
            <div className="recurring-skeleton__card" style={{ height: 44 }} />
            <div className="recurring-skeleton__card" style={{ height: 80 }} />
            <div className="recurring-skeleton__card" style={{ height: 80 }} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (isError || !schedule) {
    return (
      <AppShell>
        <Header title={t.recurringInvoices ?? 'Recurring'} backTo={ROUTES.RECURRING} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadRecurring ?? 'Could not load schedule'}
            message={t.checkConnectionTryAgain ?? 'Check your connection and try again.'}
            onRetry={refetch}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Success state ──────────────────────────────────────────────────────

  return (
    <AppShell>
      <Header
        title={schedule.name ?? schedule.partyName ?? (t.recurringInvoices ?? 'Recurring')}
        backTo={ROUTES.RECURRING}
      />

      <PageContainer className="space-y-6">
        {/* Header card */}
        <RecurringDetailHeader schedule={schedule} />

        {/* Action buttons */}
        <RecurringActionMenu
          schedule={schedule}
          onPause={pause}
          onResume={resume}
          onGenerate={generate}
          onDelete={remove}
          isPausing={isPausing}
          isResuming={isResuming}
          isGenerating={isGenerating}
          isDeleting={isDeleting}
        />

        {/* Run history section */}
        <section className="recurring-runs-section">
          <h2 className="recurring-runs-section__title">
            {t.recurringRunHistory ?? 'Run History'}
          </h2>

          {runsLoading && (
            <div className="recurring-skeleton" aria-busy="true">
              {(['r1', 'r2'] as const).map((k) => (
                <div key={k} className="recurring-skeleton__card" style={{ height: 60 }} />
              ))}
            </div>
          )}

          {runsError && (
            <p className="recurring-runs-section__error">
              {t.checkConnectionTryAgain ?? 'Could not load run history.'}
            </p>
          )}

          {!runsLoading && !runsError && runs.length === 0 && (
            <div className="recurring-runs-section__empty">
              <RefreshCw size={28} aria-hidden="true" className="recurring-runs-section__empty-icon" />
              <p>{t.recurringNoRuns ?? 'No runs yet. First invoice will generate on the scheduled date.'}</p>
            </div>
          )}

          {runs.length > 0 && (
            <div className="recurring-run-list" role="list">
              {runs.map((run) => (
                <div key={run.id} role="listitem">
                  <RunHistoryRow run={run} />
                </div>
              ))}
            </div>
          )}

          {nextCursor && (
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              style={{ marginTop: 'var(--space-3)', width: '100%' }}
              onClick={loadMore}
            >
              {t.jobLoadMore ?? 'Load more'}
            </button>
          )}
        </section>
      </PageContainer>
    </AppShell>
  )
}
