/** AddExpenseDrawer — Form to create a new expense */

import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { createExpense } from '../expense.service'
import { PAYMENT_MODE_LABELS } from '../expense.constants'
import type { ExpenseCategory, ExpensePaymentMode, CreateExpenseInput } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'

interface AddExpenseDrawerProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  categories: ExpenseCategory[]
}

const TODAY = new Date().toISOString().split('T')[0]

export function AddExpenseDrawer({ open, onClose, onCreated, categories }: AddExpenseDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<{
    categoryId: string
    amountRupees: string
    date: string
    paymentMode: ExpensePaymentMode
    notes: string
  }>({ categoryId: '', amountRupees: '', date: TODAY, paymentMode: 'CASH', notes: '' })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setError(t.enterValidAmount); return }
    setSubmitting(true)
    setError('')
    const input: CreateExpenseInput = {
      amount: amountPaise,
      date: form.date,
      paymentMode: form.paymentMode,
      notes: form.notes || undefined,
      categoryId: form.categoryId || undefined,
    }
    try {
      await createExpense(input)
      toast.success(t.expenseRecorded)
      setForm({ categoryId: '', amountRupees: '', date: TODAY, paymentMode: 'CASH', notes: '' })
      onCreated()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : t.failedRecordExpense
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [form, submitting, toast, onCreated, onClose])

  return (
    <Drawer open={open} onClose={onClose} title={t.recordExpense}>
      <form className="expense-drawer__form" onSubmit={handleSubmit}>
        {error && <p className="expense-drawer__error" role="alert">{error}</p>}
        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="expCategory">{t.categoryLabelForm}</label>
          <select id="expCategory" className="expense-drawer__select" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">-- {t.selectCategory} --</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="expense-drawer__row">
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="expAmount">{t.amountRsLabel}</label>
            <input id="expAmount" type="number" min="0.01" step="0.01" required className="expense-drawer__input" value={form.amountRupees} onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="expDate">{t.dateLabel}</label>
            <input id="expDate" type="date" required className="expense-drawer__input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
        </div>
        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="expMode">{t.paymentModeLabel}</label>
          <select id="expMode" className="expense-drawer__select" value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as ExpensePaymentMode }))}>
            {(Object.entries(PAYMENT_MODE_LABELS) as [ExpensePaymentMode, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="expNotes">{t.notesOptional}</label>
          <input id="expNotes" className="expense-drawer__input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t.expenseNotesPlaceholder} />
        </div>
        <button type="submit" className="expense-drawer__submit-btn" disabled={submitting} aria-busy={submitting}>
          {submitting ? t.loading : t.recordExpense}
        </button>
      </form>
    </Drawer>
  )
}
