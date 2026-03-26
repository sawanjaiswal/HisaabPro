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
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
  const toast = useToast()
  const { items, total, page, status, statusFilter, setStatusFilter, setPage, refresh } = useCheques()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleStatusUpdate = useCallback(async (id: string, s: ChequeStatus) => {
    try {
      await updateChequeStatus(id, { status: s })
      toast.success(`${t.chequeAriaLabel} ${CHEQUE_STATUS_LABELS[s].toLowerCase()}.`)
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : t.failedUpdateStatus)
    }
  }, [toast, refresh, t])

  const totalPages = Math.ceil(total / CHEQUE_PAGE_LIMIT)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.cheques} backTo={ROUTES.DASHBOARD} />
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
        <Header title={t.cheques} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadCheques} message={t.checkConnectionTryAgain} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.cheques} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="cheque-filter-pills" role="group" aria-label={t.filterByStatusGroup}>
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
          <span className="cheque-count">{total} {total === 1 ? t.chequeCount : t.chequesCount}</span>
          <Button variant="primary" size="sm" className="cheque-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.addCheque}>
            <Plus size={14} aria-hidden="true" /> {t.addCheque}
          </Button>
        </div>

        {items.length === 0 && (
          <div className="cheque-empty">
            <div className="cheque-empty__icon" aria-hidden="true"><CheckSquare size={32} /></div>
            <p className="cheque-empty__title">{t.noChequesRecorded}</p>
            <p className="cheque-empty__desc">{t.chequesEmptyDesc}</p>
            <Button variant="primary" size="sm" className="cheque-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.addFirstCheque}><Plus size={14} aria-hidden="true" /> {t.addFirstCheque}</Button>
          </div>
        )}

        {items.length > 0 && (
          <div className="cheque-list">
            {items.map((c) => <ChequeCard key={c.id} cheque={c} onStatusUpdate={handleStatusUpdate} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="cheque-pagination">
            <Button type="button" variant="secondary" size="sm" className="cheque-pagination__btn" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t.previousPage}>{t.previous}</Button>
            <span className="cheque-pagination__info">{t.pageLabel} {page} {t.ofLabel} {totalPages}</span>
            <Button type="button" variant="secondary" size="sm" className="cheque-pagination__btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label={t.nextPage}>{t.next}</Button>
          </div>
        )}
      </PageContainer>

      <AddChequeDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSuccess={refresh} />
    </AppShell>
  )
}
