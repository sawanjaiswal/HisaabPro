/** Expenses — the blocks above the list: trend, budget caps, pending, nav.
 *
 * Split out of ExpensesPage when the list was rebuilt to mockup #10, so the
 * page file holds the list itself and this file holds everything that sits
 * above it. Nothing here changed behaviour in that move.
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { queryKeys } from '@/lib/query-keys'
import { listPendingExpenses } from '../expense.service'
import { listBudgets } from '../services/budget.service'
import { PendingExpenseCard, PendingCardSkeleton } from './PendingExpenseCard'
import { BudgetCapsBanner } from './BudgetCapsBanner'
import { CashflowTrendCard } from './CashflowTrendCard'

interface ExpensesOverviewProps {
  /** Calendar month key (YYYY-MM) the budget caps are read for. */
  month: string
  onPendingResolved: () => void
}

export const ExpensesOverview: React.FC<ExpensesOverviewProps> = ({ month, onPendingResolved }) => {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const pendingQuery = useQuery({
    queryKey: queryKeys.expenses.pending(),
    queryFn: ({ signal }) => listPendingExpenses(signal),
  })
  const pendingItems = pendingQuery.data ?? []

  const budgetQuery = useQuery({
    queryKey: queryKeys.expenses.budgets(month),
    queryFn: ({ signal }) => listBudgets(month, signal),
  })

  return (
    <>
      <CashflowTrendCard />

      <BudgetCapsBanner
        budgets={budgetQuery.data ?? []}
        loading={budgetQuery.isPending}
        error={budgetQuery.isError}
      />

      {pendingQuery.isPending && (
        <div className="pending-row" aria-busy="true">
          <PendingCardSkeleton />
          <PendingCardSkeleton />
        </div>
      )}

      {!pendingQuery.isPending && pendingItems.length > 0 && (
        <section className="pending-row" aria-label={t.expensesPending}>
          <div className="pending-row__header">
            <Clock size={14} aria-hidden="true" />
            <span className="pending-row__title">{t.expensesPending}</span>
            <span className="pending-row__count">{pendingItems.length}</span>
            <Button
              variant="none"
              type="button"
              className="pending-row__see-all"
              onClick={() => navigate('/expenses/pending')}
            >
              {t.seeAll}
            </Button>
          </div>
          <div className="pending-row__list">
            {pendingItems.slice(0, 3).map((item) => (
              <PendingExpenseCard key={item.id} item={item} onDone={onPendingResolved} />
            ))}
          </div>
        </section>
      )}

      <div className="expenses-nav-tiles">
        <Button variant="none" type="button" className="expenses-nav-tile" onClick={() => navigate('/expenses/budgets')}>
          {t.expensesBudgetsTitle}
        </Button>
        <Button variant="none" type="button" className="expenses-nav-tile" onClick={() => navigate('/expenses/recurring')}>
          {t.expensesRecurringTitle}
        </Button>
      </div>
    </>
  )
}
