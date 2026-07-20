/** Expense Details — hero card + label/value rows (mockup #13).
 *
 * The mockup shows every row filled; here a row with no data prints an em
 * dash rather than disappearing, because "Reference: —" is the answer the
 * user came for when they are checking whether a bill number was recorded.
 */

import { Receipt } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import { PAYMENT_MODE_LABELS } from '../expense.constants'
import type { Expense } from '../expense.types'

interface ExpenseDetailRowsProps {
  expense: Expense
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ExpenseDetailRows({ expense }: ExpenseDetailRowsProps) {
  const { t } = useLanguage()
  const category = expense.categoryName ?? t.uncategorised
  const mode = PAYMENT_MODE_LABELS[expense.paymentMode]

  return (
    <>
      <div className="expense-detail-hero">
        <span className="expense-detail-hero__icon" aria-hidden="true">
          <Receipt size={20} />
        </span>

        <div className="expense-detail-hero__main">
          <div className="expense-detail-hero__category">{category}</div>
          <div className="expense-detail-hero__mode">{mode}</div>
        </div>

        <span className="expense-detail-hero__amount tabular-nums">
          {formatPaise(expense.amount)}
        </span>
      </div>

      <div className="expense-detail-card">
        <div className="expense-detail-row">
          <span className="expense-detail-label">{t.dateInfoLabel}</span>
          <span className="expense-detail-value">{formatDate(expense.date)}</span>
        </div>

        <div className="expense-detail-row">
          <span className="expense-detail-label">{t.paidToLabel}</span>
          <span className="expense-detail-value">{expense.partyName ?? '—'}</span>
        </div>

        <div className="expense-detail-row">
          <span className="expense-detail-label">{t.modeInfoLabel}</span>
          <span className="expense-detail-value">{mode}</span>
        </div>

        <div className="expense-detail-row">
          <span className="expense-detail-label">{t.referenceInfoLabel}</span>
          <span className="expense-detail-value">{expense.referenceNumber ?? '—'}</span>
        </div>

        {expense.notes && (
          <div className="expense-detail-row expense-detail-row--stacked">
            <span className="expense-detail-label">{t.notesInfoLabel}</span>
            <p className="expense-detail-value">{expense.notes}</p>
          </div>
        )}
      </div>
    </>
  )
}
