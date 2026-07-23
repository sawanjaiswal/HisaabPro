/** ExpenseDrawer — record a new expense, or edit an existing one (#13).
 *
 * One form for both: pass `expense` and it seeds the fields and PUTs instead
 * of POSTing. Duplicating this into a separate edit drawer would fork the OCR
 * prefill and the budget-overrun warning along with it.
 */

import { useState, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Select, SelectItem } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { createExpense, updateExpense } from '../expense.service'
import { checkBudget } from '../services/budget.service'
import { PAYMENT_MODE_LABELS } from '../expense.constants'
import type { Expense, ExpenseCategory, ExpensePaymentMode, CreateExpenseInput, OcrResult } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate, formatPaise } from '@/lib/format'
import { OcrReceiptUpload } from './OcrReceiptUpload'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { Button } from '@/components/ui/Button'

interface AddExpenseDrawerProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  categories: ExpenseCategory[]
  /** Present = edit mode: fields are seeded from it and the save PUTs. */
  expense?: Expense
}

const TODAY = toLocalISODate(new Date())

export function AddExpenseDrawer({ open, onClose, onCreated, categories, expense }: AddExpenseDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [warnOpen, setWarnOpen] = useState(false)
  const [warnMsg, setWarnMsg] = useState('')

  const [form, setForm] = useState<{
    categoryId: string
    amountRupees: string
    date: string
    paymentMode: ExpensePaymentMode
    notes: string
  }>(() => (expense
    ? {
        categoryId: expense.categoryId ?? '',
        amountRupees: String(expense.amount / 100),
        date: toLocalISODate(new Date(expense.date)),
        paymentMode: expense.paymentMode,
        notes: expense.notes ?? '',
      }
    : { categoryId: '', amountRupees: '', date: TODAY, paymentMode: 'CASH', notes: '' }))

  function handleOcrPrefill(result: OcrResult) {
    setForm((f) => ({
      ...f,
      amountRupees: result.amountPaise ? String(result.amountPaise / 100) : f.amountRupees,
      date: result.date ?? f.date,
      notes: result.vendor ?? f.notes,
      categoryId: result.suggestedCategoryId ?? f.categoryId,
    }))
  }

  async function doSubmit() {
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    const input: CreateExpenseInput = {
      amount: amountPaise,
      date: form.date,
      paymentMode: form.paymentMode,
      notes: form.notes || undefined,
      categoryId: form.categoryId || undefined,
    }
    setSubmitting(true)
    setError('')
    try {
      if (expense) {
        await updateExpense(expense.id, input)
        toast.success(t.expenseUpdated)
      } else {
        await createExpense(input)
        toast.success(t.expenseRecorded)
        setForm({ categoryId: '', amountRupees: '', date: TODAY, paymentMode: 'CASH', notes: '' })
      }
      onCreated()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : t.failedRecordExpense
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const amountPaise = Math.round(parseFloat(form.amountRupees) * 100)
    if (!amountPaise || amountPaise <= 0) { setError(t.enterValidAmount); return }

    // Advisory budget check — fail open (don't block on error/offline)
    try {
      const check = await checkBudget(form.categoryId || null, amountPaise)
      if (check.wouldExceed) {
        const over = formatPaise((check.currentSpent + amountPaise) - check.budgetAmount)
        setWarnMsg(
          (t.expensesOverrunWarn ?? 'This will exceed your budget by %s. Continue?')
            .replace('%s', over)
        )
        setWarnOpen(true)
        return
      }
    } catch {
      // Check failed (offline / error) — proceed without warning
    }

    await doSubmit()
  }, [form, submitting, toast, onCreated, onClose])

  return (
    <>
      <Drawer open={open} onClose={onClose} title={expense ? t.editExpense : t.recordExpense}>
        <form className="expense-drawer__form py-0" onSubmit={handleSubmit}>
          {error && <p className="expense-drawer__error py-0" role="alert">{error}</p>}

          {/* OCR scan button — above amount; only when recording something new */}
          {!expense && <OcrReceiptUpload onPrefill={handleOcrPrefill} disabled={submitting} />}

          <div className="expense-drawer__field py-0">
            <label className="expense-drawer__label py-0" htmlFor="expCategory">{t.categoryLabelForm}</label>
            <Select
              value={form.categoryId || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
              ariaLabel={t.categoryLabelForm}
              placeholder={`-- ${t.selectCategory} --`}
            >
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </Select>
          </div>
          <div className="expense-drawer__row py-0">
            <div className="expense-drawer__field py-0">
              <label className="expense-drawer__label py-0" htmlFor="expAmount">{t.amountRsLabel}</label>
              <Input id="expAmount" type="number" min="0.01" step="0.01" required className="expense-drawer__input py-0"
                value={form.amountRupees} onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="expense-drawer__field py-0">
              <label className="expense-drawer__label py-0" htmlFor="expDate">{t.dateLabel}</label>
              <DateField id="expDate" type="date" required className="expense-drawer__input py-0"
                value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="expense-drawer__field py-0">
            <label className="expense-drawer__label py-0" htmlFor="expMode">{t.paymentModeLabel}</label>
            <Select
              value={form.paymentMode}
              onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v as ExpensePaymentMode }))}
              ariaLabel={t.paymentModeLabel}
            >
              {(Object.entries(PAYMENT_MODE_LABELS) as [ExpensePaymentMode, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="expense-drawer__field py-0">
            <label className="expense-drawer__label py-0" htmlFor="expNotes">{t.notesOptional}</label>
            <Input id="expNotes" className="expense-drawer__input py-0" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t.expenseNotesPlaceholder} />
          </div>
          <Button variant="none" type="submit" className="expense-drawer__submit-btn py-0" disabled={submitting} aria-busy={submitting}>
            {submitting ? t.loading : (expense ? t.save : t.recordExpense)}
          </Button>
        </form>
      </Drawer>

      {/* Warn-on-overrun dialog */}
      <ConfirmDialog
        open={warnOpen}
        onClose={() => setWarnOpen(false)}
        onConfirm={() => { setWarnOpen(false); void doSubmit() }}
        title="Budget will be exceeded"
        description={warnMsg}
        confirmLabel="Continue Anyway"
        cancelLabel={t.cancel ?? 'Cancel'}
        isDanger={false}
        isLoading={submitting}
      />
    </>
  )
}
