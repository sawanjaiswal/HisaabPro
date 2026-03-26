/** Expenses — List Page
 *
 * Shows expenses with category filter pills.
 * AddExpenseDrawer for creating new entries.
 * 4 UI states: loading · error · empty · success.
 */

import { useState, useEffect } from 'react'
import { Plus, Receipt } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useExpenses } from './useExpenses'
import { listExpenseCategories } from './expense.service'
import { ExpenseCard } from './components/ExpenseCard'
import { AddExpenseDrawer } from './components/AddExpenseDrawer'
import { EXPENSE_PAGE_LIMIT } from './expense.constants'
import type { ExpenseCategory } from './expense.types'
import './expenses.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function ExpensesPage() {
  const { t } = useLanguage()
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

  const totalPages = Math.ceil(total / EXPENSE_PAGE_LIMIT)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.expenses ?? "Expenses"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
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
        <Header title={t.expenses ?? "Expenses"} backTo={ROUTES.DASHBOARD} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadExpenses} message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.expenses ?? "Expenses"} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        {/* Category filter pills */}
        <div className="expense-filter-bar" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`expense-filter-pill${categoryFilter === null ? ' expense-filter-pill--active' : ''}`}
            onClick={() => setCategoryFilter(null)}
            aria-pressed={categoryFilter === null}
          >
            All
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
          <span className="expense-count">{total} {total === 1 ? 'expense' : 'expenses'}</span>
          <button type="button" className="expense-add-btn" onClick={() => setDrawerOpen(true)} aria-label={t.recordExpense}>
            <Plus size={14} aria-hidden="true" /> Add Expense
          </button>
        </div>

        {items.length === 0 && (
          <div className="expense-empty">
            <div className="expense-empty__icon" aria-hidden="true"><Receipt size={32} /></div>
            <p className="expense-empty__title">{t.noExpensesRecorded}</p>
            <p className="expense-empty__desc">{t.startTrackingExpenses}</p>
            <button type="button" className="expense-add-btn" onClick={() => setDrawerOpen(true)}>
              <Plus size={14} aria-hidden="true" /> Record First Expense
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="expense-list">
            {items.map((e) => <ExpenseCard key={e.id} expense={e} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="expense-pagination">
            <button type="button" className="expense-pagination__btn" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">{t.back}</button>
            <span className="expense-pagination__info">Page {page} of {totalPages}</span>
            <button type="button" className="expense-pagination__btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">Next</button>
          </div>
        )}
      </PageContainer>

      <AddExpenseDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={refresh}
        categories={categories}
      />
    </AppShell>
  )
}
