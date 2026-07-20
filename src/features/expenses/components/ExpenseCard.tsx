/** Expense list row (mockup #10) — tinted icon square, category + mode, amount.
 *
 * Rows sit inside day groups, so the date lives in the group header and the
 * row carries the time instead.
 */

import { Receipt } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { PAYMENT_MODE_LABELS } from '../expense.constants'
import type { Expense } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'

interface ExpenseCardProps {
  expense: Expense
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function ExpenseCard({ expense }: ExpenseCardProps) {
  const { t } = useLanguage()
  const label = expense.categoryName ?? t.uncategorised

  return (
    <div className="expense-card" role="article" aria-label={`${label} ${formatPaise(expense.amount)}`}>
      <span className="expense-card__icon" aria-hidden="true">
        <Receipt size={20} />
      </span>

      <span className="expense-card__info">
        <span className="expense-card__category">{label}</span>
        {expense.notes && <span className="expense-card__notes">{expense.notes}</span>}
        <span className="expense-card__meta">{PAYMENT_MODE_LABELS[expense.paymentMode]}</span>
      </span>

      <span className="expense-card__right">
        <span className="expense-card__amount tabular-nums">{formatPaise(expense.amount)}</span>
        <span className="expense-card__time">{formatTime(expense.createdAt)}</span>
      </span>
    </div>
  )
}
