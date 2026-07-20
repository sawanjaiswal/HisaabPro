/** Expense category row (mockup #50) — tinted icon square, name, expense count.
 *
 * Categories carry their own colour, so the icon square is tinted with it
 * rather than the brand emerald — that colour is what the user picked.
 */

import React from 'react'
import { Receipt, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { ExpenseCategory } from '../expense.types'

interface ExpenseCategoryRowProps {
  category: ExpenseCategory
  onOpen: (id: string) => void
}

export const ExpenseCategoryRow: React.FC<ExpenseCategoryRowProps> = ({ category, onOpen }) => {
  const { t } = useLanguage()
  const count = category.expenseCount ?? 0

  return (
    <div className="expense-category-row" role="listitem">
      <Button
        type="button"
        variant="ghost"
        className="expense-category-row-main"
        onClick={() => onOpen(category.id)}
        aria-label={`${category.name} — ${count} ${t.expenses}`}
      >
        <span
          className="expense-category-row-icon"
          style={category.color ? { color: category.color } : undefined}
          aria-hidden="true"
        >
          <Receipt size={20} />
        </span>

        <span className="expense-category-row-text">
          <span className="expense-category-row-name">{category.name}</span>
          <span className="expense-category-row-count">
            {count} {count === 1 ? t.expenseLabel : t.expenses}
          </span>
        </span>

        <ChevronRight size={18} className="expense-category-row-chevron" aria-hidden="true" />
      </Button>
    </div>
  )
}
