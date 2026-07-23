/** AddRecurringDrawer — Form to create or edit a recurring expense template */

import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Select, SelectItem } from '@/components/ui/Select'
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
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { Button } from '@/components/ui/Button'

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
          <Select
            value={form.categoryId || undefined}
            onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            ariaLabel="Category"
            placeholder="-- Select category --"
          >
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </Select>
        </div>

        <div className="expense-drawer__row">
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recAmount">Amount (Rs)</label>
            <Input id="recAmount" type="number" min="0.01" step="0.01" required
              className="expense-drawer__input" value={form.amountRupees}
              onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recFreq">Frequency</label>
            <Select
              value={form.frequency}
              onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as RecurringFrequency }))}
              ariaLabel="Frequency"
            >
              {FREQ_OPTIONS.map((f) => <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>)}
            </Select>
          </div>
        </div>

        {(form.frequency === 'MONTHLY' || form.frequency === 'YEARLY') && (
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recDom">Day of month (1–28)</label>
            <Input id="recDom" type="number" min="1" max="28" className="expense-drawer__input"
              value={form.dayOfMonth}
              onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))} />
          </div>
        )}

        {form.frequency === 'WEEKLY' && (
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recDow">Day of week</label>
            <Select
              value={String(form.dayOfWeek)}
              onValueChange={(v) => setForm((f) => ({ ...f, dayOfWeek: Number(v) }))}
              ariaLabel="Day of week"
            >
              {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
            </Select>
          </div>
        )}

        <div className="expense-drawer__row">
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recStart">First run date</label>
            <DateField id="recStart" type="date" required className="expense-drawer__input"
              value={form.nextRunDate}
              onChange={(e) => setForm((f) => ({ ...f, nextRunDate: e.target.value }))} />
          </div>
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="recMode">Payment mode</label>
            <Select
              value={form.paymentMode}
              onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v as ExpensePaymentMode }))}
              ariaLabel="Payment mode"
            >
              {(Object.entries(PAYMENT_MODE_LABELS) as [ExpensePaymentMode, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="recNotes">Notes (optional)</label>
          <Input id="recNotes" className="expense-drawer__input" value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. Office rent" />
        </div>

        <Button variant="none" type="submit" className="expense-drawer__submit-btn" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving…' : title}
        </Button>
      </form>
    </Drawer>
  )
}
