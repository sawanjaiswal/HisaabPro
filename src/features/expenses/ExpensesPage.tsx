/** Expenses — List Page with Pending row, Budget banner, and Trend card */

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Receipt, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { queryKeys } from '@/lib/query-keys'
import { useExpenses } from './useExpenses'
import { listExpenseCategories, listPendingExpenses } from './expense.service'
import { listBudgets } from './services/budget.service'
import { ExpenseCard } from './components/ExpenseCard'
import { AddExpenseDrawer } from './components/AddExpenseDrawer'
import { PendingExpenseCard, PendingCardSkeleton } from './components/PendingExpenseCard'
import { BudgetCapsBanner } from './components/BudgetCapsBanner'
import { CashflowTrendCard } from './components/CashflowTrendCard'
import { EXPENSE_PAGE_LIMIT } from './expense.constants'
import type { ExpenseCategory } from './expense.types'
import './expenses.css'
import './expenses-upgrade.css'
import { useLanguage } from '@/hooks/useLanguage'

const NOW_MONTH = new Date().toISOString().slice(0, 7)

export default function ExpensesPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { items, total, page, status, categoryFilter, setCategoryFilter, setPage, refresh } = useExpenses()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  useEffect(() => {
    const controller = new AbortController()
    listExpenseCategories(controller.signal)
      .then(setCategories)
      .catch(() => { /* non-critical */ })
    return () => controller.abort()
  }, [])

  // Pending expenses
  const pendingQuery = useQuery({
    queryKey: queryKeys.expenses.pending(),
    queryFn: ({ signal }) => listPendingExpenses(signal),
  })
  const pendingItems = pendingQuery.data ?? []

  // Budgets for banner
  const budgetQuery = useQuery({
    queryKey: queryKeys.expenses.budgets(NOW_MONTH),
    queryFn: ({ signal }) => listBudgets(NOW_MONTH, signal),
  })

  function refreshAll() {
    refresh()
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.pending() })
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.budgets(NOW_MONTH) })
  }

  const totalPages = Math.ceil(total / EXPENSE_PAGE_LIMIT)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.expenses ?? 'Expenses'} backTo={ROUTES.DASHBOARD} />
        <PageContainer className="space-y-6">
          <div className="expense-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3', 'sk-4'].map((k) => <div key={k} className="expense-skeleton__card" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={t.expenses ?? 'Expenses'} backTo={ROUTES.DASHBOARD} />
        <PageContainer className="space-y-6">
          <ErrorState title={t.couldNotLoadExpenses} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.expenses ?? 'Expenses'} backTo={ROUTES.DASHBOARD} />
      <PageContainer className="space-y-6">

        {/* Trend card */}
        <CashflowTrendCard />

        {/* Budget caps banner */}
        <BudgetCapsBanner
          budgets={budgetQuery.data ?? []}
          loading={budgetQuery.isPending}
          error={budgetQuery.isError}
        />

        {/* Pending confirmations row */}
        {pendingQuery.isPending && (
          <div className="pending-row" aria-busy="true">
            <PendingCardSkeleton />
            <PendingCardSkeleton />
          </div>
        )}
        {!pendingQuery.isPending && pendingItems.length > 0 && (
          <section className="pending-row" aria-label={t.expensesPending ?? 'Pending confirmations'}>
            <div className="pending-row__header">
              <Clock size={14} aria-hidden="true" />
              <span className="pending-row__title">{t.expensesPending ?? 'Pending'}</span>
              <span className="pending-row__count">{pendingItems.length}</span>
              <button
                type="button"
                className="pending-row__see-all"
                onClick={() => navigate('/expenses/pending')}
              >
                See all
              </button>
            </div>
            <div className="pending-row__list">
              {pendingItems.slice(0, 3).map((item) => (
                <PendingExpenseCard key={item.id} item={item} onDone={refreshAll} />
              ))}
            </div>
          </section>
        )}

        {/* Quick nav tiles */}
        <div className="expenses-nav-tiles">
          <button type="button" className="expenses-nav-tile" onClick={() => navigate('/expenses/budgets')}>
            {t.expensesBudgetsTitle ?? 'Budgets'}
          </button>
          <button type="button" className="expenses-nav-tile" onClick={() => navigate('/expenses/recurring')}>
            {t.expensesRecurringTitle ?? 'Recurring'}
          </button>
        </div>

        {/* Category filter pills */}
        <div className="expense-filter-bar stagger-filters" role="group" aria-label={t.filterByCategoryGroup}>
          <button
            type="button"
            className={`expense-filter-pill${categoryFilter === null ? ' expense-filter-pill--active' : ''}`}
            onClick={() => setCategoryFilter(null)}
            aria-pressed={categoryFilter === null}
          >
            {t.all}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`expense-filter-pill${categoryFilter === c.id ? ' expense-filter-pill--active' : ''}`}
              onClick={() => setCategoryFilter(c.id)}
              aria-pressed={categoryFilter === c.id}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="expense-action-bar">
          <span className="expense-count">{total} {total === 1 ? t.expenseSingular : t.expensesPlural}</span>
          <button type="button" className="expense-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.recordExpense}>
            <Plus size={14} aria-hidden="true" /> {t.addExpenseBtn}
          </button>
        </div>

        {items.length === 0 && (
          <div className="expense-empty">
            <div className="expense-empty__icon" aria-hidden="true"><Receipt size={32} /></div>
            <p className="expense-empty__title">{t.noExpensesRecorded}</p>
            <p className="expense-empty__desc">{t.startTrackingExpenses}</p>
            <button type="button" className="expense-add-btn" onClick={() => setDrawerOpen(true)}>
              <Plus size={14} aria-hidden="true" /> {t.recordFirstExpense}
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="expense-list stagger-list">
            {items.map((e) => <ExpenseCard key={e.id} expense={e} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="expense-pagination">
            <button type="button" className="expense-pagination__btn" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t.previousPage}>{t.back}</button>
            <span className="expense-pagination__info">{t.pageXOfY} {page} {t.ofLabel} {totalPages}</span>
            <button type="button" className="expense-pagination__btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label={t.nextPage}>{t.next}</button>
          </div>
        )}
      </PageContainer>

      <AddExpenseDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={refreshAll}
        categories={categories}
      />
    </AppShell>
  )
}
