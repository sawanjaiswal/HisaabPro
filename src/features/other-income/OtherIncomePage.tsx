/** Other Income — List Page
 *
 * 4 UI states: loading · error · empty · success.
 * Category filter pills. Inline drawer to add entries.
 */

import { useState, useCallback, useMemo } from 'react'
import { TrendingUp, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { useOtherIncome } from './useOtherIncome'
import { createOtherIncome } from './other-income.service'
import type { OtherIncome, OtherIncomePaymentMode, CreateOtherIncomeInput } from './other-income.types'
import './other-income.css'
import { useLanguage } from '@/hooks/useLanguage'

const PAGE_LIMIT = 20

const PAYMENT_MODE_LABELS: Record<OtherIncomePaymentMode, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', CARD: 'Card',
}

const COMMON_CATEGORIES = ['Interest', 'Rental', 'Commission', 'Refund', 'Dividend', 'Other']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function IncomeCard({ item }: { item: OtherIncome }) {
  return (
    <div className="income-card" role="article" aria-label={`Income: ${formatPaise(item.amount)}`}>
      <div className="income-card__icon" aria-hidden="true"><TrendingUp size={20} /></div>
      <div className="income-card__info">
        <span className="income-card__category">{item.category ?? 'Other Income'}</span>
        {item.notes && <span className="income-card__notes">{item.notes}</span>}
        <span className="income-card__meta">{formatDate(item.date)} &middot; {PAYMENT_MODE_LABELS[item.paymentMode]}</span>
      </div>
      <span className="income-card__amount">{formatPaise(item.amount)}</span>
    </div>
  )
}

const TODAY = new Date().toISOString().split('T')[0]

export default function OtherIncomePage() {
  const { t } = useLanguage()
  const toast = useToast()
  const { items, total, page, status, categoryFilter, setCategoryFilter, setPage, refresh } = useOtherIncome()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<{ category: string; amountRupees: string; date: string; paymentMode: OtherIncomePaymentMode; notes: string }>({
    category: '', amountRupees: '', date: TODAY, paymentMode: 'CASH', notes: '',
  })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setFormError(t.enterValidAmount); return }
    setSubmitting(true); setFormError('')
    const input: CreateOtherIncomeInput = {
      amount: amountPaise, date: form.date, paymentMode: form.paymentMode,
      category: form.category || undefined, notes: form.notes || undefined,
    }
    try {
      await createOtherIncome(input)
      toast.success(t.incomeRecorded)
      setForm({ category: '', amountRupees: '', date: TODAY, paymentMode: 'CASH', notes: '' })
      setDrawerOpen(false); refresh()
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : t.failedRecordIncome)
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, refresh])

  const totalPages = Math.ceil(total / PAGE_LIMIT)
  const knownCategories = useMemo(
    () => Array.from(new Set([...COMMON_CATEGORIES, ...items.map((i) => i.category).filter(Boolean) as string[]])),
    [items],
  )

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.otherIncome ?? "Other Income"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <div className="income-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="income-skeleton__card" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.otherIncome ?? "Other Income"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadIncome} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.otherIncome ?? "Other Income"} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <div className="income-filter-bar stagger-filters" role="group" aria-label={t.filterByCategoryGroup}>
          <button type="button" className={`income-filter-pill${categoryFilter === null ? ' income-filter-pill--active' : ''}`} onClick={() => setCategoryFilter(null)} aria-pressed={categoryFilter === null}>{t.all}</button>
          {knownCategories.map((c) => (
            <button key={c} type="button" className={`income-filter-pill${categoryFilter === c ? ' income-filter-pill--active' : ''}`} onClick={() => setCategoryFilter(c)} aria-pressed={categoryFilter === c}>{c}</button>
          ))}
        </div>

        <div className="income-action-bar">
          <span className="income-count">{total} {total === 1 ? t.incomeSingular : t.incomeEntriesPlural}</span>
          <button type="button" className="income-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.addIncomeEntryAria}>
            <Plus size={14} aria-hidden="true" /> {t.addIncomeBtn}
          </button>
        </div>

        {items.length === 0 && (
          <div className="income-empty">
            <div className="income-empty__icon" aria-hidden="true"><TrendingUp size={32} /></div>
            <p className="income-empty__title">{t.noOtherIncomeRecorded}</p>
            <p className="income-empty__desc">{t.trackInterestRent}</p>
            <button type="button" className="income-add-btn" onClick={() => setDrawerOpen(true)}><Plus size={14} aria-hidden="true" /> {t.addFirstEntry}</button>
          </div>
        )}

        {items.length > 0 && <div className="income-list stagger-list">{items.map((i) => <IncomeCard key={i.id} item={i} />)}</div>}

        {totalPages > 1 && (
          <div className="income-pagination">
            <button type="button" className="income-pagination__btn" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t.previousPage}>{t.back}</button>
            <span className="income-pagination__info">{t.pageXOfY} {page} {t.ofLabel} {totalPages}</span>
            <button type="button" className="income-pagination__btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label={t.nextPage}>{t.next}</button>
          </div>
        )}
      </PageContainer>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t.addOtherIncome}>
        <form className="income-drawer__form" onSubmit={handleSubmit}>
          {formError && <p className="income-drawer__error" role="alert">{formError}</p>}
          <div className="income-drawer__field">
            <label className="income-drawer__label" htmlFor="incCategory">{t.categoryLabel}</label>
            <input id="incCategory" className="income-drawer__input" list="income-categories" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Interest, Rental" />
            <datalist id="income-categories">{COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="income-drawer__row">
            <div className="income-drawer__field">
              <label className="income-drawer__label" htmlFor="incAmount">{t.amountRsLabel}</label>
              <input id="incAmount" type="number" min="0.01" step="0.01" required className="income-drawer__input" value={form.amountRupees} onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="income-drawer__field">
              <label className="income-drawer__label" htmlFor="incDate">{t.dateLabel}</label>
              <input id="incDate" type="date" required className="income-drawer__input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="income-drawer__field">
            <label className="income-drawer__label" htmlFor="incMode">{t.paymentModeLabel}</label>
            <select id="incMode" className="income-drawer__select" value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as OtherIncomePaymentMode }))}>
              {(Object.entries(PAYMENT_MODE_LABELS) as [OtherIncomePaymentMode, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="income-drawer__field">
            <label className="income-drawer__label" htmlFor="incNotes">{t.notesOptional}</label>
            <input id="incNotes" className="income-drawer__input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t.incomeNotesPlaceholder} />
          </div>
          <button type="submit" className="income-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
            {submitting ? t.loading : t.recordIncome}
          </button>
        </form>
      </Drawer>
    </AppShell>
  )
}
