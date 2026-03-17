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
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { useCheques } from './useCheques'
import { createCheque, updateChequeStatus } from './cheque.service'
import {
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_COLORS,
  CHEQUE_STATUS_BG,
  CHEQUE_TYPE_LABELS,
  CHEQUE_FILTER_OPTIONS,
  CHEQUE_PAGE_LIMIT,
} from './cheque.constants'
import type { Cheque, ChequeType, ChequeStatus, CreateChequeInput } from './cheque.types'
import './cheques.css'

function formatPaise(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ChequeCardProps {
  cheque: Cheque
  onStatusUpdate: (id: string, status: ChequeStatus) => void
}

function ChequeCard({ cheque, onStatusUpdate }: ChequeCardProps) {
  return (
    <div className="cheque-card" role="article" aria-label={`Cheque #${cheque.chequeNumber}`}>
      <div className="cheque-card__header">
        <div>
          <div className="cheque-card__number">
            #{cheque.chequeNumber}
            <span className="cheque-card__type-badge" style={{ marginLeft: 'var(--space-2)' }}>
              {CHEQUE_TYPE_LABELS[cheque.type]}
            </span>
          </div>
          <div className="cheque-card__bank">{cheque.bankName}</div>
        </div>
        <span
          className="cheque-card__status-badge"
          style={{ background: CHEQUE_STATUS_BG[cheque.status], color: CHEQUE_STATUS_COLORS[cheque.status] }}
        >
          {CHEQUE_STATUS_LABELS[cheque.status]}
        </span>
      </div>
      <div className="cheque-card__footer">
        <span className="cheque-card__party">{cheque.partyName ?? '—'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span className="cheque-card__amount">{formatPaise(cheque.amount)}</span>
          <span className="cheque-card__date">{formatDate(cheque.chequeDate)}</span>
        </div>
      </div>
      {cheque.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button
            type="button"
            className="cheque-add-btn"
            style={{ flex: 1, fontSize: '0.8125rem', minHeight: '36px' }}
            onClick={() => onStatusUpdate(cheque.id, 'CLEARED')}
            aria-label="Mark cheque as cleared"
          >
            Mark Cleared
          </button>
          <button
            type="button"
            className="cheque-add-btn"
            style={{ flex: 1, fontSize: '0.8125rem', minHeight: '36px', background: 'var(--color-error-600)' }}
            onClick={() => onStatusUpdate(cheque.id, 'BOUNCED')}
            aria-label="Mark cheque as bounced"
          >
            Mark Bounced
          </button>
        </div>
      )}
    </div>
  )
}

const TODAY = new Date().toISOString().split('T')[0]

export default function ChequesPage() {
  const toast = useToast()
  const { items, total, page, status, statusFilter, setStatusFilter, setPage, refresh } = useCheques()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<CreateChequeInput>({
    chequeNumber: '', bankName: '', type: 'RECEIVED', amount: 0, chequeDate: TODAY,
  })

  const handleStatusUpdate = useCallback(async (id: string, s: ChequeStatus) => {
    try {
      await updateChequeStatus(id, { status: s })
      toast.success(`Cheque marked ${CHEQUE_STATUS_LABELS[s].toLowerCase()}.`)
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status.')
    }
  }, [toast, refresh])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true); setFormError('')
    try {
      await createCheque({ ...form, amount: form.amount * 100 })
      toast.success('Cheque added.')
      setForm({ chequeNumber: '', bankName: '', type: 'RECEIVED', amount: 0, chequeDate: TODAY })
      setDrawerOpen(false); refresh()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add cheque.')
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, refresh])

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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Cheque">
        <form className="cheque-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="cheque-drawer__error" role="alert">{formError}</p>}
          <div className="cheque-drawer__row">
            <div className="cheque-drawer__field">
              <label className="cheque-drawer__label" htmlFor="chqNumber">Cheque Number</label>
              <input id="chqNumber" required className="cheque-drawer__input" value={form.chequeNumber} onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))} placeholder="Cheque #" />
            </div>
            <div className="cheque-drawer__field">
              <label className="cheque-drawer__label" htmlFor="chqType">Type</label>
              <select id="chqType" className="cheque-drawer__select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ChequeType }))}>
                <option value="RECEIVED">Received</option>
                <option value="ISSUED">Issued</option>
              </select>
            </div>
          </div>
          <div className="cheque-drawer__field">
            <label className="cheque-drawer__label" htmlFor="chqBank">Bank Name</label>
            <input id="chqBank" required className="cheque-drawer__input" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" />
          </div>
          <div className="cheque-drawer__row">
            <div className="cheque-drawer__field">
              <label className="cheque-drawer__label" htmlFor="chqAmount">Amount (₹)</label>
              <input id="chqAmount" type="number" min="0.01" step="0.01" required className="cheque-drawer__input" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
            </div>
            <div className="cheque-drawer__field">
              <label className="cheque-drawer__label" htmlFor="chqDate">Cheque Date</label>
              <input id="chqDate" type="date" required className="cheque-drawer__input" value={form.chequeDate} onChange={(e) => setForm((f) => ({ ...f, chequeDate: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="cheque-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Saving...' : 'Add Cheque'}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
