/** ExpenseCard — Individual expense list item */

import { Receipt } from 'lucide-react'
import { PAYMENT_MODE_LABELS } from '../expense.constants'
import type { Expense } from '../expense.types'

interface ExpenseCardProps {
  expense: Expense
}

function formatPaise(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ExpenseCard({ expense }: ExpenseCardProps) {
  return (
    <div className="expense-card" role="article" aria-label={`Expense: ${formatPaise(expense.amount)}`}>
      <div className="expense-card__icon" aria-hidden="true">
        <Receipt size={20} />
      </div>
      <div className="expense-card__info">
        <span className="expense-card__category">
          {expense.categoryName ?? 'Uncategorised'}
        </span>
        {expense.notes && (
          <span className="expense-card__notes">{expense.notes}</span>
        )}
        <span className="expense-card__meta">
          {formatDate(expense.date)} &middot; {PAYMENT_MODE_LABELS[expense.paymentMode]}
        </span>
      </div>
      <span className="expense-card__amount">{formatPaise(expense.amount)}</span>
    </div>
  )
}
