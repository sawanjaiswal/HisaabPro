/** Recurring Invoices List Page
 *
 * Displays all recurring invoice schedules with status filter pills,
 * create drawer, and manual generate trigger.
 * 4 UI states: loading skeleton · error · empty · success.
 */

import { useState, useCallback } from 'react'
import { RefreshCw, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { useRecurringList } from './hooks/useRecurringList'
import { RecurringCard } from './components/RecurringCard'
import { RecurringCreateDrawer } from './components/RecurringCreateDrawer'
import {
  RECURRING_STATUS_FILTER_OPTIONS,
  RECURRING_PAGE_LIMIT,
} from './recurring.constants'
import {
  createRecurring,
  updateRecurring,
  deleteRecurring,
  generateDueInvoices,
} from './recurring.service'
import type { CreateRecurringInput } from './recurring.types'
import './recurring.css'

export default function RecurringListPage() {
  const toast = useToast()
  const { items, total, page, status, statusFilter, setStatusFilter, setPage, refresh } =
    useRecurringList()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  const totalPages = Math.ceil(total / RECURRING_PAGE_LIMIT)

  // ── Create ─────────────────────────────────────────────────────────────

  const handleCreate = useCallback(
    async (input: CreateRecurringInput) => {
      await createRecurring(input)
      toast.success('Recurring schedule created.')
      refresh()
    },
    [toast, refresh]
  )

  // ── Pause / Resume ──────────────────────────────────────────────────────

  const handlePause = useCallback(
    async (id: string) => {
      try {
        await updateRecurring(id, { status: 'PAUSED' })
        toast.success('Schedule paused.')
        refresh()
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to pause schedule.'
        toast.error(message)
      }
    },
    [toast, refresh]
  )

  const handleResume = useCallback(
    async (id: string) => {
      try {
        await updateRecurring(id, { status: 'ACTIVE' })
        toast.success('Schedule resumed.')
        refresh()
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to resume schedule.'
        toast.error(message)
      }
    },
    [toast, refresh]
  )

  // ── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteRecurring(id)
        toast.success('Schedule deleted.')
        refresh()
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to delete schedule.'
        toast.error(message)
      }
    },
    [toast, refresh]
  )

  // ── Manual generate ─────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    try {
      const result = await generateDueInvoices()
      toast.success(
        result.generated === 0
          ? 'No invoices due right now.'
          : `Generated ${result.generated} invoice${result.generated === 1 ? '' : 's'}.`
      )
      refresh()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Generation failed.'
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }, [generating, toast, refresh])

  // ── Loading state ───────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Recurring Invoices" backTo={ROUTES.INVOICES} />
        <PageContainer>
          <div className="recurring-skeleton" aria-busy="true" aria-label="Loading schedules">
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
        <Header title="Recurring Invoices" backTo={ROUTES.INVOICES} />
        <PageContainer>
          <ErrorState
            title="Could not load recurring invoices"
            message="Check your connection and try again."
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
        title="Recurring Invoices"
        backTo={ROUTES.INVOICES}
      />

      <PageContainer>
        {/* Filter pills */}
        <div className="recurring-filter-pills" role="group" aria-label="Filter by status">
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
            {total} {total === 1 ? 'schedule' : 'schedules'}
          </span>
          <div className="recurring-action-bar__buttons">
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={handleGenerate}
              disabled={generating}
              aria-busy={generating}
              aria-label="Manually generate due invoices"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {generating ? 'Generating...' : 'Generate Due'}
            </button>
            <button
              type="button"
              className="recurring-btn recurring-btn--primary"
              onClick={() => setDrawerOpen(true)}
              aria-label="Create new recurring schedule"
            >
              <Plus size={14} aria-hidden="true" />
              New Schedule
            </button>
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="recurring-empty">
            <div className="recurring-empty__icon" aria-hidden="true">
              <RefreshCw size={32} />
            </div>
            <p className="recurring-empty__title">No recurring schedules</p>
            <p className="recurring-empty__desc">
              Create a recurring schedule to automatically generate invoices on a set frequency.
            </p>
            <button
              type="button"
              className="recurring-btn recurring-btn--primary"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus size={14} aria-hidden="true" />
              Create First Schedule
            </button>
          </div>
        )}

        {/* List */}
        {items.length > 0 && (
          <div className="recurring-list">
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
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="recurring-pagination__info">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="recurring-btn recurring-btn--secondary"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              Next
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
