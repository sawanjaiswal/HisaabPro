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
import { getLoanStatement, recordLoanTransaction } from './loan.service'
import type { LoanStatement, LoanTransactionType, CreateLoanTransactionInput } from './loan.types'
import './loans.css'

const TXN_TYPE_LABELS: Record<LoanTransactionType, string> = {
  DISBURSEMENT: 'Disbursement', REPAYMENT: 'Repayment', INTEREST: 'Interest', PENALTY: 'Penalty',
}

const TXN_AMOUNT_CLASS: Record<LoanTransactionType, string> = {
  DISBURSEMENT: 'loan-txn-card__amount--disbursement',
  REPAYMENT: 'loan-txn-card__amount--repayment',
  INTEREST: 'loan-txn-card__amount--interest',
  PENALTY: 'loan-txn-card__amount--interest',
}

function formatPaise(p: number): string {
  return (p / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TODAY = new Date().toISOString().split('T')[0]

export default function LoanDetailPage() {
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
        toast.error(err instanceof ApiError ? err.message : 'Failed to load loan details')
      })
    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || submitting) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setFormError('Enter a valid amount.'); return }
    setSubmitting(true); setFormError('')
    const input: CreateLoanTransactionInput = { type: form.type, amount: amountPaise, date: form.date, notes: form.notes || undefined }
    try {
      await recordLoanTransaction(id, input)
      toast.success('Transaction recorded.')
      setForm({ type: 'REPAYMENT', amountRupees: '', date: TODAY, notes: '' })
      setDrawerOpen(false); refresh()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to record transaction.')
    } finally {
      setSubmitting(false)
    }
  }, [id, form, submitting, toast, refresh])

  if (fetchStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Loan Details" backTo={ROUTES.LOANS} />
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
        <Header title="Loan Details" backTo={ROUTES.LOANS} />
        <PageContainer>
          <ErrorState title="Could not load loan details" message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  const { loan, transactions, totalPaid, totalInterest } = statement

  return (
    <AppShell>
      <Header title={loan.partyName ?? 'Loan Details'} backTo={ROUTES.LOANS} />
      <PageContainer>
        <div className="loan-detail__hero">
          <p className="loan-detail__label">Outstanding Balance</p>
          <p className="loan-detail__outstanding">{formatPaise(loan.outstandingAmount)}</p>
          <div className="loan-detail__grid">
            <div><p className="loan-detail__label">Principal</p><p className="loan-detail__value">{formatPaise(loan.principalAmount)}</p></div>
            <div><p className="loan-detail__label">Interest Rate</p><p className="loan-detail__value">{loan.interestRate}% p.a.</p></div>
            <div><p className="loan-detail__label">Total Paid</p><p className="loan-detail__value">{formatPaise(totalPaid)}</p></div>
            <div><p className="loan-detail__label">Total Interest</p><p className="loan-detail__value">{formatPaise(totalInterest)}</p></div>
            <div><p className="loan-detail__label">Start Date</p><p className="loan-detail__value">{formatDate(loan.startDate)}</p></div>
            {loan.emiAmount && <div><p className="loan-detail__label">EMI</p><p className="loan-detail__value">{formatPaise(loan.emiAmount)}/mo</p></div>}
          </div>
          {loan.status === 'ACTIVE' && (
            <button type="button" className="loan-add-btn" style={{ marginTop: 'var(--space-4)', width: '100%', justifyContent: 'center' }} onClick={() => setDrawerOpen(true)} aria-label="Record loan payment">
              <Plus size={14} aria-hidden="true" /> Record Transaction
            </button>
          )}
        </div>

        <p className="loan-detail__section-title">Transaction History</p>

        {transactions.length === 0 && (
          <div className="loan-empty">
            <p className="loan-empty__title">No transactions yet</p>
            <p className="loan-empty__desc">Record payments and interest entries to track this loan.</p>
          </div>
        )}

        {transactions.length > 0 && (
          <div className="loan-txn-list">
            {transactions.map((txn) => (
              <div key={txn.id} className="loan-txn-card">
                <div className="loan-txn-card__info">
                  <div className="loan-txn-card__type">{TXN_TYPE_LABELS[txn.type]}</div>
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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Record Transaction">
        <form className="loan-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="loan-drawer__error" role="alert">{formError}</p>}
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="txnType">Transaction Type</label>
            <select id="txnType" className="loan-drawer__select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LoanTransactionType }))}>
              {(Object.entries(TXN_TYPE_LABELS) as [LoanTransactionType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="loan-drawer__row">
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="txnAmount">Amount (₹)</label>
              <input id="txnAmount" type="number" min="0.01" step="0.01" required className="loan-drawer__input" value={form.amountRupees} onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="loan-drawer__field">
              <label className="loan-drawer__label" htmlFor="txnDate">Date</label>
              <input id="txnDate" type="date" required className="loan-drawer__input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="loan-drawer__field">
            <label className="loan-drawer__label" htmlFor="txnNotes">Notes (optional)</label>
            <input id="txnNotes" className="loan-drawer__input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Payment details" />
          </div>
          <button type="submit" className="loan-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Saving...' : 'Record Transaction'}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
