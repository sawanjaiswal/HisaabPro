/** BudgetCapsBanner — Shows amber/red alert pills for categories at 85%+ */

import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { BudgetUsageItem } from '../expense.types'
import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'

interface BudgetCapsBannerProps {
  budgets: BudgetUsageItem[]
  loading?: boolean
  error?: boolean
}

const MAX_VISIBLE = 5

export function BudgetCapsBanner({ budgets, loading, error }: BudgetCapsBannerProps) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="budget-caps-banner" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="budget-caps-pill budget-caps-pill--skeleton" aria-hidden="true" />
        ))}
      </div>
    )
  }

  if (error) return null

  // Only show warn (≥85%) and over (≥100%)
  const alerts = budgets
    .filter((b) => b.severity === 'warn' || b.severity === 'over')
    .slice(0, MAX_VISIBLE)

  if (alerts.length === 0) return null

  return (
    <div className="budget-caps-banner" role="region" aria-label="Budget alerts">
      {alerts.map((b) => {
        const isOver = b.severity === 'over'
        const name = b.categoryName ?? 'Overall'
        const overshootPaise = b.spentPaise - b.budgetPaise
        return (
          <div
            key={b.id}
            className={`budget-caps-pill budget-caps-pill--${b.severity}`}
            role="status"
            aria-label={isOver
              ? `${name} budget exceeded by ${formatPaise(overshootPaise)}`
              : `${name} at ${b.percent}%`}
          >
            {isOver
              ? <TrendingUp size={12} aria-hidden="true" />
              : <AlertTriangle size={12} aria-hidden="true" />}
            <span className="budget-caps-pill__name">{name}</span>
            <span className="budget-caps-pill__pct">{b.percent}%</span>
            {isOver && (
              <span className="budget-caps-pill__label">
                {t.expensesBudgetOverLabel ?? 'Over'}
              </span>
            )}
            {!isOver && (
              <span className="budget-caps-pill__label">
                {t.expensesBudgetWarnLabel ?? 'Warn'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
