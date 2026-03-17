/** Cheques — Cheque Register Page
 *
 * Tabs: All / Pending / Cleared / Bounced.
 * Add cheque drawer, update status inline.
 * 4 UI states: loading · error · empty · success.
 */

import { useState, useCallback } from 'react'
import { CheckSquare, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { useCheques } from './useCheques'
import { updateChequeStatus } from './cheque.service'
import { CHEQUE_STATUS_LABELS, CHEQUE_FILTER_OPTIONS, CHEQUE_PAGE_LIMIT } from './cheque.constants'
import type { ChequeStatus } from './cheque.types'
import { ChequeCard } from './components/ChequeCard'
import { AddChequeDrawer } from './components/AddChequeDrawer'
import './cheques.css'

export default function ChequesPage() {
  const toast = useToast()
  const { items, total, page, status, statusFilter, setStatusFilter, setPage, refresh } = useCheques()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleStatusUpdate = useCallback(async (id: string, s: ChequeStatus) => {
    try {
      await updateChequeStatus(id, { status: s })
      toast.success(`Cheque marked ${CHEQUE_STATUS_LABELS[s].toLowerCase()}.`)
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status.')
    }
  }, [toast, refresh])

  const totalPages = Math.ceil(total / CHEQUE_PAGE_LIMIT)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Cheques" backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <div className="cheque-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="cheque-skeleton__card" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="Cheques" backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title="Could not load cheques" message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Cheques" backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="cheque-filter-pills" role="group" aria-label="Filter by status">
          {CHEQUE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`cheque-filter-pill${statusFilter === opt.value ? ' cheque-filter-pill--active' : ''}`}
              onClick={() => setStatusFilter(opt.value)}
              aria-pressed={statusFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="cheque-action-bar">
          <span className="cheque-count">{total} {total === 1 ? 'cheque' : 'cheques'}</span>
          <button type="button" className="cheque-add-btn" onClick={() => setDrawerOpen(true)} aria-label="Add cheque">
            <Plus size={14} aria-hidden="true" /> Add Cheque
          </button>
        </div>

        {items.length === 0 && (
          <div className="cheque-empty">
            <div className="cheque-empty__icon" aria-hidden="true"><CheckSquare size={32} /></div>
            <p className="cheque-empty__title">No cheques recorded</p>
            <p className="cheque-empty__desc">Track cheques received from customers and issued to suppliers.</p>
            <button type="button" className="cheque-add-btn" onClick={() => setDrawerOpen(true)}><Plus size={14} aria-hidden="true" /> Add First Cheque</button>
          </div>
        )}

        {items.length > 0 && (
          <div className="cheque-list">
            {items.map((c) => <ChequeCard key={c.id} cheque={c} onStatusUpdate={handleStatusUpdate} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="cheque-pagination">
            <button type="button" className="cheque-pagination__btn" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">Previous</button>
            <span className="cheque-pagination__info">Page {page} of {totalPages}</span>
            <button type="button" className="cheque-pagination__btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">Next</button>
          </div>
        )}
      </PageContainer>

      <AddChequeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSuccess={refresh} />
    </AppShell>
  )
}
