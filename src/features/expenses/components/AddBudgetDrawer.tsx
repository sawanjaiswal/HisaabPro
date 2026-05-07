/** AddBudgetDrawer — Form to set/upsert a budget for a category + month */

import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { upsertBudget, updateBudget } from '../services/budget.service'
import type { ExpenseCategory, BudgetUsageItem } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'

interface AddBudgetDrawerProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categories: ExpenseCategory[]
  /** Pass existing budget to edit mode */
  existing?: BudgetUsageItem
  /** Pre-select month, e.g. "2026-05" */
  defaultMonth?: string
}

export function AddBudgetDrawer({
  open, onClose, onSaved, categories, existing, defaultMonth,
}: AddBudgetDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const nowMonth = defaultMonth ?? new Date().toISOString().slice(0, 7)

  const [form, setForm] = useState({
    categoryId: existing?.categoryId ?? '',
    month: existing?.month ?? nowMonth,
    amountRupees: existing ? String(existing.budgetPaise / 100) : '',
  })

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    try {
      if (existing) {
        await updateBudget(existing.id, amountPaise)
      } else {
        await upsertBudget({
          categoryId: form.categoryId || undefined,
          month: form.month,
          amount: amountPaise,
        })
      }
      toast.success(t.expensesBudgetSetAction ?? 'Budget updated')
      onSaved()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save budget'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }, [form, saving, existing, toast, onSaved, onClose])

  return (
    <Drawer open={open} onClose={onClose} title={t.expensesBudgetSetAction ?? 'Set Budget'}>
      <form className="expense-drawer__form" onSubmit={handleSubmit}>
        {error && <p className="expense-drawer__error" role="alert">{error}</p>}

        {!existing && (
          <div className="expense-drawer__field">
            <label className="expense-drawer__label" htmlFor="budgetCategory">
              Category (leave blank for overall)
            </label>
            <select
              id="budgetCategory"
              className="expense-drawer__select"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">-- Overall (all categories) --</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="budgetMonth">Month</label>
          <input
            id="budgetMonth"
            type="month"
            required
            className="expense-drawer__input"
            value={form.month}
            disabled={Boolean(existing)}
            onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
          />
        </div>

        <div className="expense-drawer__field">
          <label className="expense-drawer__label" htmlFor="budgetAmount">Budget Amount (Rs)</label>
          <input
            id="budgetAmount"
            type="number"
            min="1"
            step="0.01"
            required
            className="expense-drawer__input"
            value={form.amountRupees}
            onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))}
            placeholder="0.00"
          />
        </div>

        <button
          type="submit"
          className="expense-drawer__submit-btn"
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? 'Saving…' : (t.expensesBudgetSetAction ?? 'Set Budget')}
        </button>
      </form>
    </Drawer>
  )
}
