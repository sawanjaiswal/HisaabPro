/** BudgetRow — Single budget progress bar row */

import type { BudgetUsageItem } from '../expense.types'
import { formatPaise } from '@/lib/format'
import { Button } from '@/components/ui/Button'

interface BudgetRowProps {
  item: BudgetUsageItem
  onEdit?: () => void
}

export function BudgetRow({ item, onEdit }: BudgetRowProps) {
  const name = item.categoryName ?? 'Overall'
  const pct = Math.min(item.percent, 100)
  const overPaise = item.spentPaise - item.budgetPaise

  return (
    <div
      className={`budget-row budget-row--${item.severity}`}
      role="listitem"
      aria-label={`${name} budget: ${item.percent}% used`}
    >
      <div className="budget-row__header">
        <span className="budget-row__name">{name}</span>
        {onEdit && (
          <Button variant="none"
            type="button"
            className="budget-row__edit-btn"
            onClick={onEdit}
            aria-label={`Edit ${name} budget`}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="budget-row__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`budget-row__fill budget-row__fill--${item.severity}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="budget-row__meta">
        <span className="budget-row__spent">{formatPaise(item.spentPaise)} spent</span>
        <span className="budget-row__budget">of {formatPaise(item.budgetPaise)}</span>
        {item.severity === 'over' && (
          <span className="budget-row__over">+{formatPaise(overPaise)} over</span>
        )}
      </div>
    </div>
  )
}

export function BudgetRowSkeleton() {
  return (
    <div className="budget-row budget-row--skeleton" aria-busy="true" aria-label="Loading budget">
      <div className="budget-row__skel-line" style={{ width: '6rem' }} />
      <div className="budget-row__skel-track" />
      <div className="budget-row__skel-line" style={{ width: '9rem' }} />
    </div>
  )
}
