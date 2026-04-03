/** Loan Detail Page
 *
 * Shows loan summary + transaction history.
 * "Record Payment" button opens a quick form.
 * 4 UI states: loading · error · empty · success.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getLoanStatement, recordLoanTransaction } from './loan.service'
import type { LoanStatement, LoanTransactionType, CreateLoanTransactionInput } from './loan.types'
import './loans.css'
import { useLanguage } from '@/hooks/useLanguage'

// TXN_TYPE_LABELS resolved via t at render time — see getTxnTypeLabel()
function getTxnTypeLabel(type: LoanTransactionType, t: { disbursement: string; repayment: string; interest: string; penalty: string }): string {
  const map: Record<LoanTransactionType, string> = {
    DISBURSEMENT: t.disbursement,
    REPAYMENT: t.repayment,
    INTEREST: t.interest,
    PENALTY: t.penalty,
  }
  return map[type]
}

const TXN_AMOUNT_CLASS: Record<LoanTransactionType, string> = {
  DISBURSEMENT: 'loan-txn-card__amount--disbursement',
  REPAYMENT: 'loan-txn-card__amount--repayment',
  INTEREST: 'loan-txn-card__amount--interest',
  PENALTY: 'loan-txn-card__amount--interest',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TODAY = new Date().toISOString().split('T')[0]

export default function LoanDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const [statement, setStatement] = useState<LoanStatement | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<{ type: LoanTransactionType; amountRupees: string; date: string; notes: string }>({
    type: 'REPAYMENT', amountRupees: '', date: TODAY, notes: '',
  })

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setFetchStatus('loading')
    getLoanStatement(id, controller.signal)
      .then((s) => { setStatement(s); setFetchStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        toast.error(err instanceof ApiError ? err.message : t.couldNotLoadLoans)
      })
    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || submitting) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setFormError(t.enterValidAmount); return }
    setSubmitting(true); setFormError('')
    const input: CreateLoanTransactionInput = { type: form.type, amount: amountPaise, date: form.date, notes: form.notes || undefined }
    try {
      await recordLoanTransaction(id, input)
      toast.success(t.transactionRecorded)
      setForm({ type: 'REPAYMENT', amountRupees: '', date: TODAY, notes: '' })
      setDrawerOpen(false); refresh()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : t.failedRecordTxn)
    } finally {
      setSubmitting(false)
    }
  }, [id, form, submitting, toast, refresh])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.loans ?? "Loan Details"} backTo={ROUTES.LOANS} />
        <PageContainer>
          <div className="loan-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="loan-skeleton__card" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (fetchStatus === 'error' || !statement) {
    return (
      <AppShell>
        <Header title={t.loans ?? "Loan Details"} backTo={ROUTES.LOANS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadLoans} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  const { loan, transactions, totalPaid, totalInterest } = statement

  return (
    <AppShell>
      <Header title={loan.partyName ?? t.loanDetailsTitle} backTo={ROUTES.LOANS} />
      <PageContainer>
        <div className="loan-detail__hero fade-up">
          <p className="loan-detail__label">{t.outstandingBalance}</p>
          <p className="loan-detail__outstanding">{formatPaise(loan.outstandingAmount)}</p>
          <div className="loan-detail__grid">
            <div><p className="loan-detail__label">{t.principal}</p><p className="loan-detail__value">{formatPaise(loan.principalAmount)}</p></div>
            <div><p className="loan-detail__label">{t.interestRatePercent}</p><p className="loan-detail__value">{loan.interestRate}% p.a.</p></div>
            <div><p className="loan-detail__label">{t.totalPaid}</p><p className="loan-detail__value">{formatPaise(totalPaid)}</p></div>
            <div><p className="loan-detail__label">{t.totalInterest}</p><p className="loan-detail__value">{formatPaise(totalInterest)}</p></div>
            <div><p className="loan-detail__label">{t.dateLabel}</p><p className="loan-detail__value">{formatDate(loan.startDate)}</p></div>
            {loan.emiAmount && <div><p className="loan-detail__label">{t.emiColon}</p><p className="loan-detail__value">{formatPaise(loan.emiAmount)}/mo</p></div>}
          </div>
          {loan.status === 'ACTIVE' && (
            <button type="button" className="loan-add-btn loan-detail__action-btn" onClick={() => setDrawerOpen(true)} aria-label={t.recordTransaction}>
              <Plus size={14} aria-hidden="true" /> {t.recordTransaction}
            </button>
          )}
        </div>

        <p className="loan-detail__section-title">{t.transactionHistoryLoan}</p>

        {transactions.length === 0 && (
          <div className="loan-empty">
            <p className="loan-empty__title">{t.noTxnYetLoan}</p>
            <p className="loan-empty__desc">{t.recordPaymentsInterest}</p>
          </div>
        )}

        {transactions.length > 0 && (
          <div className="loan-txn-list">
            {transactions.map((txn) => (
              <div key={txn.id} className="loan-txn-card">
                <div className="loan-txn-card__info">
                  <div className="loan-txn-card__type">{getTxnTypeLabel(txn.type, t)}</div>
                  <div className="loan-txn-card__date">{formatDate(txn.date)}{txn.notes ? ` · ${txn.notes}` : ''}</div>
                </div>
                <span className={`loan-txn-card__amount ${TXN_AMOUNT_CLASS[txn.type]}`}>
                  {formatPaise(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </PageContainer>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t.recordTransaction}>
        <form className="loan-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="loan-drawer__error" role="alert">{formError}</p>}
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="txnType">{t.loanType}</label>
            <select id="txnType" className="loan-drawer__select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LoanTransactionType }))}>
              {(['DISBURSEMENT', 'REPAYMENT', 'INTEREST', 'PENALTY'] as LoanTransactionType[]).map((type) => (
                <option key={type} value={type}>{getTxnTypeLabel(type, t)}</option>
              ))}
            </select>
          </div>
          <div className="loan-drawer__row">
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="txnAmount">{t.amountRsLabel}</label>
              <input id="txnAmount" type="number" min="0.01" step="0.01" required className="loan-drawer__input" value={form.amountRupees} onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="txnDate">{t.dateLabel}</label>
              <input id="txnDate" type="date" required className="loan-drawer__input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="txnNotes">{t.notesOptional}</label>
            <input id="txnNotes" className="loan-drawer__input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t.txnNotesPlaceholder} />
          </div>
          <button type="submit" className="loan-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? t.loading : t.recordTransaction}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
