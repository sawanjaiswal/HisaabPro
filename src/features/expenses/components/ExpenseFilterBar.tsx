/** Expense list filters (mockup #10) — All / This month / category pills.
 *
 * The mockup shows a "Category" dropdown; the categories are few enough to
 * stay inline as pills, which keeps the filter one tap instead of two. The
 * last pill opens the full category list (#50).
 */

import React from 'react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { ExpenseCategory } from '../expense.types'

interface ExpenseFilterBarProps {
  categories: ExpenseCategory[]
  categoryFilter: string | null
  onCategoryChange: (id: string | null) => void
  thisMonthOnly: boolean
  onThisMonthChange: (on: boolean) => void
  onManageCategories: () => void
}

export const ExpenseFilterBar: React.FC<ExpenseFilterBarProps> = ({
  categories,
  categoryFilter,
  onCategoryChange,
  thisMonthOnly,
  onThisMonthChange,
  onManageCategories,
}) => {
  const { t } = useLanguage()
  const showingAll = categoryFilter === null && !thisMonthOnly

  const pillClass = (active: boolean) =>
    `expense-filter-pill${active ? ' expense-filter-pill--active' : ''}`

  return (
    <div className="expense-filter-bar stagger-filters" role="group" aria-label={t.filterByCategoryGroup}>
      <Button
        variant="none"
        type="button"
        className={pillClass(showingAll)}
        onClick={() => { onCategoryChange(null); onThisMonthChange(false) }}
        aria-pressed={showingAll}
      >
        {t.all}
      </Button>

      <Button
        variant="none"
        type="button"
        className={pillClass(thisMonthOnly)}
        onClick={() => onThisMonthChange(!thisMonthOnly)}
        aria-pressed={thisMonthOnly}
      >
        {t.thisMonth}
      </Button>

      {categories.map((c) => (
        <Button
          variant="none"
          key={c.id}
          type="button"
          className={pillClass(categoryFilter === c.id)}
          onClick={() => onCategoryChange(categoryFilter === c.id ? null : c.id)}
          aria-pressed={categoryFilter === c.id}
        >
          {c.name}
        </Button>
      ))}

      <Button variant="none" type="button" className="expense-filter-pill" onClick={onManageCategories}>
        {t.manageCategories}
      </Button>
    </div>
  )
}
