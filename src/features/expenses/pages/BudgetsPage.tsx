/** BudgetsPage — Monthly budget utilization with progress bars */

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronLeft, ChevronRight, PiggyBank } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { queryKeys } from '@/lib/query-keys'
import { listBudgets } from '../services/budget.service'
import { listExpenseCategories } from '../expense.service'
import { BudgetRow, BudgetRowSkeleton } from '../components/BudgetRow'
import { AddBudgetDrawer } from '../components/AddBudgetDrawer'
import type { ExpenseCategory, BudgetUsageItem } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'
import '../expenses.css'
import '../expenses-upgrade.css'

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function BudgetsPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetUsageItem | undefined>()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    listExpenseCategories(ctrl.signal).then(setCategories).catch(() => {})
    return () => ctrl.abort()
  }, [])

  const query = useQuery({
    queryKey: queryKeys.expenses.budgets(month),
    queryFn: ({ signal }) => listBudgets(month, signal),
  })

  function onSaved() {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.budgets(month) })
  }

  function openAdd() {
    setEditItem(undefined)
    setDrawerOpen(true)
  }

  function openEdit(item: BudgetUsageItem) {
    setEditItem(item)
    setDrawerOpen(true)
  }

  const title = t.expensesBudgetsTitle ?? 'Budgets'

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.EXPENSES} />
      <PageContainer variant="list" className="space-y-6">

        {/* Month navigator */}
        <div className="budgets-month-nav" role="navigation" aria-label="Month navigation">
          <button type="button" className="budgets-month-nav__btn" onClick={() => setMonth(prevMonth(month))} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="budgets-month-nav__label">{monthLabel(month)}</span>
          <button type="button" className="budgets-month-nav__btn" onClick={() => setMonth(nextMonth(month))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>

        {query.isPending && (
          <div aria-busy="true" role="list" aria-label="Loading budgets">
            {[0, 1, 2, 3].map((i) => <BudgetRowSkeleton key={i} />)}
          </div>
        )}

        {query.isError && (
          <ErrorState
            title="Could not load budgets"
            message="Check your connection and try again."
            onRetry={() => query.refetch()}
          />
        )}

        {!query.isPending && !query.isError && (
          <>
            {(query.data ?? []).length === 0 ? (
              <div className="expense-empty">
                <div className="expense-empty__icon" aria-hidden="true"><PiggyBank size={32} /></div>
                <p className="expense-empty__title">No budgets set</p>
                <p className="expense-empty__desc">Set spending limits per category to track your expenses.</p>
                <button type="button" className="expense-add-btn" onClick={openAdd}>
                  <Plus size={14} aria-hidden="true" /> {t.expensesBudgetSetAction ?? 'Set Budget'}
                </button>
              </div>
            ) : (
              <div role="list" aria-label="Budget rows" className="space-y-3">
                {(query.data ?? []).map((item) => (
                  <BudgetRow key={item.id} item={item} onEdit={() => openEdit(item)} />
                ))}
              </div>
            )}
          </>
        )}

        {(query.data ?? []).length > 0 && (
          <button type="button" className="expense-add-btn" onClick={openAdd} style={{ marginTop: '1rem' }}>
            <Plus size={14} aria-hidden="true" /> {t.expensesBudgetSetAction ?? 'Add Budget'}
          </button>
        )}
      </PageContainer>

      <AddBudgetDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={onSaved}
        categories={categories}
        existing={editItem}
        defaultMonth={month}
      />
    </AppShell>
  )
}
