/** Recurring Invoices List Page
 *
 * Displays all recurring invoice schedules with status filter pills,
 * create drawer, and manual generate trigger.
 * 4 UI states: loading skeleton · error · empty · success.
 */

import { useState } from 'react'
import { RefreshCw, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useRecurringList } from './hooks/useRecurringList'
import { useRecurringActions } from './hooks/useRecurringActions'
import { RecurringCard } from './components/RecurringCard'
import { RecurringCreateDrawer } from './components/RecurringCreateDrawer'
import {
  RECURRING_STATUS_FILTER_OPTIONS,
  RECURRING_PAGE_LIMIT,
} from './recurring.constants'
import './recurring.css'

export default function RecurringListPage() {
  const { t } = useLanguage()
  const { items, total, page, status, statusFilter, setStatusFilter, setPage, refresh } =
    useRecurringList()
  const { handleCreate, handlePause, handleResume, handleDelete, handleGenerate, generating } =
    useRecurringActions(refresh)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const totalPages = Math.ceil(total / RECURRING_PAGE_LIMIT)

  // ── Loading state ───────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.recurringInvoices} backTo={ROUTES.INVOICES} />
        <PageContainer>
          <div className="recurring-skeleton" aria-busy="true" aria-label={t.loadingSchedules}>
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
        <Header title={t.recurringInvoices} backTo={ROUTES.INVOICES} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadRecurring}
            message={t.checkConnectionTryAgain}
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
        title={t.recurringInvoices}
        backTo={ROUTES.INVOICES}
      />

      <PageContainer>
        {/* Filter pills */}
        <div className="recurring-filter-pills stagger-filters" role="group" aria-label={t.filterByStatusGroup}>
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
            {total} {total === 1 ? t.scheduleCount : t.schedulesCount}
          </span>
          <div className="recurring-action-bar__buttons">
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={handleGenerate}
              disabled={generating}
              aria-busy={generating}
              aria-label={t.manuallyGenerateDue}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {generating ? t.generatingDue : t.generateDue}
            </button>
            <button
              type="button"
              className="recurring-btn recurring-btn--primary"
              onClick={() => setDrawerOpen(true)}
              aria-label={t.createNewSchedule}
            >
              <Plus size={14} aria-hidden="true" />
              {t.newSchedule}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="recurring-empty">
            <div className="recurring-empty__icon" aria-hidden="true">
              <RefreshCw size={32} />
            </div>
            <p className="recurring-empty__title">{t.noRecurringSchedules}</p>
            <p className="recurring-empty__desc">
              {t.recurringEmptyDesc}
            </p>
            <button
              type="button"
              className="recurring-btn recurring-btn--primary"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus size={14} aria-hidden="true" />
              {t.createFirstSchedule}
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
              aria-label={t.previousPage}
            >
              {t.previous}
            </button>
            <span className="recurring-pagination__info">
              {t.pageLabel} {page} {t.ofLabel} {totalPages}
            </span>
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              aria-label={t.nextPage}
            >
              {t.next}
            </button>
          </div>
        )}
      </PageContainer>

      <RecurringCreateDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleCreate}
      />
    </AppShell>
  )
}
