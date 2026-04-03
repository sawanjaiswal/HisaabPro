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
import { useLanguage } from '@/hooks/useLanguage'

// Status labels resolved via t at render time — see getLoanStatusLabel()
function getLoanStatusLabel(status: LoanStatus, t: { activeLoan: string; closedLoan2: string; overdueLoan: string }): string {
  const map: Record<LoanStatus, string> = {
    ACTIVE: t.activeLoan,
    CLOSED: t.closedLoan2,
    OVERDUE: t.overdueLoan,
  }
  return map[status]
}
const STATUS_COLORS: Record<LoanStatus, string> = {
  ACTIVE: 'var(--color-info-600)', CLOSED: 'var(--color-gray-500)', OVERDUE: 'var(--color-error-600)',
}
const STATUS_BG: Record<LoanStatus, string> = {
  ACTIVE: 'var(--color-info-bg-subtle)', CLOSED: 'var(--color-gray-100)', OVERDUE: 'var(--color-error-bg-subtle)',
}

function LoanCard({ loan, onClick }: { loan: Loan; onClick: (id: string) => void }) {
  const { t } = useLanguage()
  return (
    <div className="loan-card" role="button" onClick={() => onClick(loan.id)} aria-label={`Loan: ${loan.partyName ?? 'Unknown'}`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick(loan.id)}>
      <div className="loan-card__header">
        <div>
          <div className="loan-card__party">{loan.partyName ?? t.personalLoan}</div>
          <div className="loan-card__type">{loan.loanType === 'TAKEN' ? t.loanTaken : t.loanGiven}</div>
        </div>
        <span className="loan-card__status-badge" style={{ background: STATUS_BG[loan.status], color: STATUS_COLORS[loan.status] }}>
          {getLoanStatusLabel(loan.status, t)}
        </span>
      </div>
      <div className="loan-card__amounts">
        <div>
          <div className="loan-card__principal">{t.principalColon} {formatPaise(loan.principalAmount)}</div>
          {loan.emiAmount && <div className="loan-card__emi">{t.emiColon} {formatPaise(loan.emiAmount)}/mo</div>}
        </div>
        <div className="loan-card__outstanding">{formatPaise(loan.outstandingAmount)}</div>
      </div>
    </div>
  )
}

const TODAY = new Date().toISOString().split('T')[0]

export default function LoansPage() {
  const { t } = useLanguage()
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
    if (!principalPaise || principalPaise <= 0) { setFormError(t.enterValidPrincipal); return }
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
      toast.success(t.loanAdded)
      setForm({ loanType: 'TAKEN', principalRupees: '', interestRate: '', startDate: TODAY, emiRupees: '', notes: '' })
      setDrawerOpen(false); refresh()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : t.failedAddLoan)
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, refresh])

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.loans ?? "Loans"} backTo={ROUTES.DASHBOARD} />
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
        <Header title={t.loans ?? "Loans"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadLoans} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.loans ?? "Loans"} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="loan-action-bar">
          <span className="loan-count">{total} {total === 1 ? t.loanSingular : t.loansPlural}</span>
          <button type="button" className="loan-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.addFirstLoan}>
            <Plus size={14} aria-hidden="true" /> {t.addLoanBtn}
          </button>
        </div>

        {items.length === 0 && (
          <div className="loan-empty">
            <div className="loan-empty__icon" aria-hidden="true"><Landmark size={32} /></div>
            <p className="loan-empty__title">{t.noLoansAdded}</p>
            <p className="loan-empty__desc">{t.trackLoansDesc}</p>
            <button type="button" className="loan-add-btn" onClick={() => setDrawerOpen(true)}><Plus size={14} aria-hidden="true" /> {t.addFirstLoan}</button>
          </div>
        )}

        {items.length > 0 && (
          <div className="loan-list stagger-list">
            {items.map((l) => <LoanCard key={l.id} loan={l} onClick={(id) => navigate(ROUTES.LOAN_DETAIL.replace(':id', id))} />)}
          </div>
        )}
      </PageContainer>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t.addFirstLoan}>
        <form className="loan-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="loan-drawer__error" role="alert">{formError}</p>}
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="loanType">{t.loanType}</label>
            <select id="loanType" className="loan-drawer__select" value={form.loanType} onChange={(e) => setForm((f) => ({ ...f, loanType: e.target.value as LoanType }))}>
              <option value="TAKEN">{t.loanTakenBorrowed}</option>
              <option value="GIVEN">{t.loanGivenLent}</option>
            </select>
          </div>
          <div className="loan-drawer__row">
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanPrincipal">{t.principalRs}</label>
              <input id="loanPrincipal" type="number" min="1" step="0.01" required className="loan-drawer__input" value={form.principalRupees} onChange={(e) => setForm((f) => ({ ...f, principalRupees: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanRate">{t.interestRatePercent}</label>
              <input id="loanRate" type="number" min="0" step="0.01" className="loan-drawer__input" value={form.interestRate} onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))} placeholder="e.g. 12.5" />
            </div>
          </div>
          <div className="loan-drawer__row">
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanStart">{t.dateLabel}</label>
              <input id="loanStart" type="date" required className="loan-drawer__input" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="loanEmi">{t.emiRsOptional}</label>
              <input id="loanEmi" type="number" min="0" step="0.01" className="loan-drawer__input" value={form.emiRupees} onChange={(e) => setForm((f) => ({ ...f, emiRupees: e.target.value }))} placeholder={t.emiMonthlyPlaceholder} />
            </div>
          </div>
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="loanNotes">{t.notesOptional}</label>
            <input id="loanNotes" className="loan-drawer__input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t.loanNotesPlaceholder} />
          </div>
          <button type="submit" className="loan-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? t.loading : t.addFirstLoan}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
