/** Loans — List Page
 *
 * Shows all loans with outstanding balance and status.
 * Add loan drawer. Navigate to detail on card click.
 * 4 UI states: loading · error · empty · success.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { useLoans } from './useLoans'
import { createLoan } from './loan.service'
import type { Loan, LoanStatus, LoanType, CreateLoanInput } from './loan.types'
import './loans.css'

const STATUS_LABELS: Record<LoanStatus, string> = {
  ACTIVE: 'Active', CLOSED: 'Closed', OVERDUE: 'Overdue',
}
const STATUS_COLORS: Record<LoanStatus, string> = {
  ACTIVE: 'var(--color-info-600)', CLOSED: 'var(--color-gray-500)', OVERDUE: 'var(--color-error-600)',
}
const STATUS_BG: Record<LoanStatus, string> = {
  ACTIVE: 'var(--color-info-bg-subtle)', CLOSED: 'var(--color-gray-100)', OVERDUE: 'var(--color-error-bg-subtle)',
}

function LoanCard({ loan, onClick }: { loan: Loan; onClick: (id: string) => void }) {
  return (
    <div className="loan-card" role="button" onClick={() => onClick(loan.id)} aria-label={`Loan: ${loan.partyName ?? 'Unknown'}`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick(loan.id)}>
      <div className="loan-card__header">
        <div>
          <div className="loan-card__party">{loan.partyName ?? 'Personal Loan'}</div>
          <div className="loan-card__type">{loan.loanType === 'TAKEN' ? 'Loan Taken' : 'Loan Given'}</div>
        </div>
        <span className="loan-card__status-badge" style={{ background: STATUS_BG[loan.status], color: STATUS_COLORS[loan.status] }}>
          {STATUS_LABELS[loan.status]}
        </span>
      </div>
      <div className="loan-card__amounts">
        <div>
          <div className="loan-card__principal">Principal: {formatPaise(loan.principalAmount)}</div>
          {loan.emiAmount && <div className="loan-card__emi">EMI: {formatPaise(loan.emiAmount)}/mo</div>}
        </div>
        <div className="loan-card__outstanding">{formatPaise(loan.outstandingAmount)}</div>
      </div>
    </div>
  )
}

const TODAY = new Date().toISOString().split('T')[0]

export default function LoansPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { items, total, status, refresh } = useLoans()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<{ loanType: LoanType; principalRupees: string; interestRate: string; startDate: string; emiRupees: string; notes: string }>({
    loanType: 'TAKEN', principalRupees: '', interestRate: '', startDate: TODAY, emiRupees: '', notes: '',
  })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const principalPaise = Math.round(parseFloat(form.principalRupees) * 100)
    if (!principalPaise || principalPaise <= 0) { setFormError('Enter a valid principal amount.'); return }
    setSubmitting(true); setFormError('')
    const input: CreateLoanInput = {
      loanType: form.loanType,
      principalAmount: principalPaise,
      interestRate: parseFloat(form.interestRate) || 0,
      startDate: form.startDate,
      emiAmount: form.emiRupees ? Math.round(parseFloat(form.emiRupees) * 100) : undefined,
      notes: form.notes || undefined,
    }
    try {
      await createLoan(input)
      toast.success('Loan added.')
      setForm({ loanType: 'TAKEN', principalRupees: '', interestRate: '', startDate: TODAY, emiRupees: '', notes: '' })
      setDrawerOpen(false); refresh()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add loan.')
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, refresh])

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Loans" backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <div className="loan-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="loan-skeleton__card" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="Loans" backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title="Could not load loans" message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Loans" backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="loan-action-bar">
          <span className="loan-count">{total} {total === 1 ? 'loan' : 'loans'}</span>
          <button type="button" className="loan-add-btn" onClick={() => setDrawerOpen(true)} aria-label="Add loan">
            <Plus size={14} aria-hidden="true" /> Add Loan
          </button>
        </div>

        {items.length === 0 && (
          <div className="loan-empty">
            <div className="loan-empty__icon" aria-hidden="true"><Landmark size={32} /></div>
            <p className="loan-empty__title">No loans added</p>
            <p className="loan-empty__desc">Track loans taken from banks or individuals, and loans given to others.</p>
            <button type="button" className="loan-add-btn" onClick={() => setDrawerOpen(true)}><Plus size={14} aria-hidden="true" /> Add First Loan</button>
          </div>
        )}

        {items.length > 0 && (
          <div className="loan-list">
            {items.map((l) => <LoanCard key={l.id} loan={l} onClick={(id) => navigate(ROUTES.LOAN_DETAIL.replace(':id', id))} />)}
          </div>
        )}
      </PageContainer>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Loan">
        <form className="loan-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="loan-drawer__error" role="alert">{formError}</p>}
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="loanType">Loan Type</label>
            <select id="loanType" className="loan-drawer__select" value={form.loanType} onChange={(e) => setForm((f) => ({ ...f, loanType: e.target.value as LoanType }))}>
              <option value="TAKEN">Loan Taken (borrowed)</option>
              <option value="GIVEN">Loan Given (lent)</option>
            </select>
          </div>
          <div className="loan-drawer__row">
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanPrincipal">Principal (₹)</label>
              <input id="loanPrincipal" type="number" min="1" step="0.01" required className="loan-drawer__input" value={form.principalRupees} onChange={(e) => setForm((f) => ({ ...f, principalRupees: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanRate">Interest Rate (%)</label>
              <input id="loanRate" type="number" min="0" step="0.01" className="loan-drawer__input" value={form.interestRate} onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))} placeholder="e.g. 12.5" />
            </div>
          </div>
          <div className="loan-drawer__row">
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanStart">Start Date</label>
              <input id="loanStart" type="date" required className="loan-drawer__input" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanEmi">EMI (₹, optional)</label>
              <input id="loanEmi" type="number" min="0" step="0.01" className="loan-drawer__input" value={form.emiRupees} onChange={(e) => setForm((f) => ({ ...f, emiRupees: e.target.value }))} placeholder="Monthly EMI" />
            </div>
          </div>
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="loanNotes">Notes (optional)</label>
            <input id="loanNotes" className="loan-drawer__input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional details" />
          </div>
          <button type="submit" className="loan-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Saving...' : 'Add Loan'}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
