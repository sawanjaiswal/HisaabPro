/** Recurring Invoices List Page
 *
 * 4 UI states: loading skeleton · error · empty · success.
 * Cards are clickable to navigate to detail.
 */

import { useNavigate } from 'react-router-dom'
import { RefreshCw, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useRecurringList } from '../hooks/useRecurringList'
import { useRecurringActions } from '../hooks/useRecurringActions'
import { RecurringCard } from '../components/RecurringCard'
import {
  RECURRING_STATUS_FILTER_OPTIONS,
  RECURRING_PAGE_LIMIT,
} from '../recurring.constants'
import '../recurring.css'

export default function RecurringListPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { items, total, page, status, statusFilter, setStatusFilter, setPage, refresh } =
    useRecurringList()
  const { handlePause, handleResume, handleDelete, handleGenerate, generating } =
    useRecurringActions(refresh)

  const totalPages = Math.ceil(total / RECURRING_PAGE_LIMIT)

  // ── Loading state ───────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.recurringInvoices ?? 'Recurring'} backTo={ROUTES.INVOICES} />
        <PageContainer className="space-y-6">
          <div className="recurring-skeleton" aria-busy="true" aria-label={t.loadingSchedules ?? 'Loading schedules'}>
            {(['sk-1', 'sk-2', 'sk-3', 'sk-4'] as const).map((key) => (
              <div key={key} className="recurring-skeleton__card" />
            ))}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.recurringInvoices ?? 'Recurring'} backTo={ROUTES.INVOICES} />
        <PageContainer className="space-y-6">
          <ErrorState
            title={t.couldNotLoadRecurring ?? 'Could not load schedules'}
            message={t.checkConnectionTryAgain ?? 'Check your connection and try again.'}
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Success (+ empty) state ─────────────────────────────────────────────

  return (
    <AppShell>
      <Header
        title={t.recurringInvoices ?? 'Recurring'}
        backTo={ROUTES.INVOICES}
      />

      <PageContainer className="space-y-6">
        {/* Filter pills */}
        <div className="recurring-filter-pills stagger-filters" role="group" aria-label={t.filterByStatusGroup ?? 'Filter by status'}>
          {RECURRING_STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`recurring-filter-pill${
                statusFilter === opt.value ? ' recurring-filter-pill--active' : ''
              }`}
              onClick={() => setStatusFilter(opt.value)}
              aria-pressed={statusFilter === opt.value}
              aria-label={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div className="recurring-action-bar">
          <span className="recurring-count">
            {total} {total === 1 ? (t.scheduleCount ?? 'schedule') : (t.schedulesCount ?? 'schedules')}
          </span>
          <div className="recurring-action-bar__buttons">
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={() => void handleGenerate()}
              disabled={generating}
              aria-busy={generating}
              aria-label={t.manuallyGenerateDue ?? 'Manually generate due invoice'}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {generating ? (t.generatingDue ?? 'Generating...') : (t.generateDue ?? 'Generate Due')}
            </button>
            <button
              type="button"
              className="recurring-btn recurring-btn--primary"
              onClick={() => navigate(ROUTES.RECURRING_NEW)}
              aria-label={t.createNewSchedule ?? 'Create new schedule'}
            >
              <Plus size={14} aria-hidden="true" />
              {t.newSchedule ?? 'New Schedule'}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="recurring-empty">
            <div className="recurring-empty__icon" aria-hidden="true">
              <RefreshCw size={32} />
            </div>
            <p className="recurring-empty__title">{t.noRecurringSchedules ?? 'No recurring schedules'}</p>
            <p className="recurring-empty__desc">
              {t.recurringEmptyDesc ?? 'Automate your invoicing with recurring schedules'}
            </p>
            <button
              type="button"
              className="recurring-btn recurring-btn--primary"
              onClick={() => navigate(ROUTES.RECURRING_NEW)}
            >
              <Plus size={14} aria-hidden="true" />
              {t.createFirstSchedule ?? 'Create your first schedule'}
            </button>
          </div>
        )}

        {/* List */}
        {items.length > 0 && (
          <div className="recurring-list stagger-list">
            {items.map((item) => (
              <RecurringCard
                key={item.id}
                item={item}
                onPause={handlePause}
                onResume={handleResume}
                onDelete={handleDelete}
                onClick={() => navigate(`/recurring/${item.id}`)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="recurring-pagination">
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              aria-label={t.previousPage ?? 'Previous page'}
            >
              {t.previous ?? 'Previous'}
            </button>
            <span className="recurring-pagination__info">
              {t.pageLabel ?? 'Page'} {page} {t.ofLabel ?? 'of'} {totalPages}
            </span>
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              aria-label={t.nextPage ?? 'Next page'}
            >
              {t.next ?? 'Next'}
            </button>
          </div>
        )}
      </PageContainer>

    </AppShell>
  )
}
