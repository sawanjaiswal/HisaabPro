/** AddRecurringDrawer — Form to create or edit a recurring expense template */

import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { createTemplate, updateTemplate } from '../services/recurring.service'
import { PAYMENT_MODE_LABELS } from '../expense.constants'
import type {
  ExpenseCategory, ExpensePaymentMode,
  RecurringFrequency, RecurringTemplate,
} from '../expense.types'
import { toLocalISODate } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'

const FREQ_OPTIONS: RecurringFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
const FREQ_LABELS: Record<RecurringFrequency, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly',
}
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AddRecurringDrawerProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categories: ExpenseCategory[]
  existing?: RecurringTemplate
}

const TODAY = toLocalISODate(new Date())

export function AddRecurringDrawer({
  open, onClose, onSaved, categories, existing,
}: AddRecurringDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    categoryId: existing?.categoryId ?? '',
    amountRupees: existing ? String(existing.amountPaise / 100) : '',
    frequency: (existing?.frequency ?? 'MONTHLY') as RecurringFrequency,
    dayOfMonth: existing?.dayOfMonth ?? 1,
    dayOfWeek: existing?.dayOfWeek ?? 1,
    nextRunDate: existing?.nextRunDate?.slice(0, 10) ?? TODAY,
    paymentMode: (existing?.paymentMode ?? 'CASH') as ExpensePaymentMode,
    notes: existing?.notes ?? '',
  })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setError('Enter a valid amount'); return }
    if (!form.categoryId) { setError('Select a category'); return }

    const payload = {
      categoryId: form.categoryId,
      amountPaise,
      frequency: form.frequency,
      ...(form.frequency === 'MONTHLY' || form.frequency === 'YEARLY'
        ? { dayOfMonth: form.dayOfMonth } : {}),
      ...(form.frequency === 'WEEKLY'
        ? { dayOfWeek: form.dayOfWeek } : {}),
      nextRunDate: form.nextRunDate,
      paymentMode: form.paymentMode,
      notes: form.notes || undefined,
    }

    setSaving(true)
    setError('')
    try {
      if (existing) {
        await updateTemplate(existing.id, payload)
      } else {
        await createTemplate(payload)
      }
      toast.success(t.expensesRecurringAddAction ?? 'Recurring expense saved')
      onSaved()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }, [form, saving, existing, toast, onSaved, onClose])

  const title = existing
    ? 'Edit Recurring Expense'
    : (t.expensesRecurringAddAction ?? 'Add Recurring Expense')

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <form className="expense-drawer__form" onSubmit={handleSubmit}>
        {error && <p className="expense-drawer__error" role="alert">{error}</p>}

        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="recCategory">Category</label>
          <select id="recCategory" className="expense-drawer__select" value={form.categoryId} required
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">-- Select category --</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="expense-drawer__row">
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recAmount">Amount (Rs)</label>
            <input id="recAmount" type="number" min="0.01" step="0.01" required
              className="expense-drawer__input" value={form.amountRupees}
              onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recFreq">Frequency</label>
            <select id="recFreq" className="expense-drawer__select" value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as RecurringFrequency }))}>
              {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
            </select>
          </div>
        </div>

        {(form.frequency === 'MONTHLY' || form.frequency === 'YEARLY') && (
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recDom">Day of month (1–28)</label>
            <input id="recDom" type="number" min="1" max="28" className="expense-drawer__input"
              value={form.dayOfMonth}
              onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))} />
          </div>
        )}

        {form.frequency === 'WEEKLY' && (
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recDow">Day of week</label>
            <select id="recDow" className="expense-drawer__select" value={form.dayOfWeek}
              onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}>
              {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}

        <div className="expense-drawer__row">
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recStart">First run date</label>
            <input id="recStart" type="date" required className="expense-drawer__input"
              value={form.nextRunDate}
              onChange={(e) => setForm((f) => ({ ...f, nextRunDate: e.target.value }))} />
          </div>
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recMode">Payment mode</label>
            <select id="recMode" className="expense-drawer__select" value={form.paymentMode}
              onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as ExpensePaymentMode }))}>
              {(Object.entries(PAYMENT_MODE_LABELS) as [ExpensePaymentMode, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="recNotes">Notes (optional)</label>
          <input id="recNotes" className="expense-drawer__input" value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. Office rent" />
        </div>

        <button type="submit" className="expense-drawer__submit-btn" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving…' : title}
        </button>
      </form>
    </Drawer>
  )
}
