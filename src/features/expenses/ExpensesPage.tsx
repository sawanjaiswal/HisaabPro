/** Expenses — List Page, mockup #10.
 *
 * Archetype A: search → segments → day-grouped rows with day totals → totals
 * and sparkline footer. The overview blocks (trend, budget caps, pending
 * confirmations, budgets/recurring nav) sit above the list in ExpensesOverview.
 *
 * "This month" narrows server-side; search filters the fetched page in memory
 * because /expenses has no search parameter.
 */

import { useMemo, useState } from 'react'
import { Plus, Receipt, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PeriodGroup } from '@/components/ui/PeriodGroup'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { ROUTES } from '@/config/routes.config'
import { queryKeys } from '@/lib/query-keys'
import { groupByPeriod, toPeriodTotalsSeries } from '@/lib/period-groups.utils'
import { useLanguage } from '@/hooks/useLanguage'
import { useExpenses } from './useExpenses'
import { useExpenseCategoryList } from './useExpenseCategoryList'
import { ExpenseCard } from './components/ExpenseCard'
import { ExpenseFilterBar } from './components/ExpenseFilterBar'
import { ExpensesOverview } from './components/ExpensesOverview'
import { AddExpenseDrawer } from './components/AddExpenseDrawer'
import { EXPENSE_PAGE_LIMIT } from './expense.constants'
import './expenses.css'
import './expenses-upgrade.css'

const NOW_MONTH = new Date().toISOString().slice(0, 7)

export default function ExpensesPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    items, total, page, status, refresh,
    categoryFilter, setCategoryFilter,
    thisMonthOnly, setThisMonthOnly,
    search, setSearch, setPage,
  } = useExpenses()
  const categories = useExpenseCategoryList()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const groups = useMemo(
    () => groupByPeriod(items, (e) => e.date, (e) => e.amount, 'day'),
    [items],
  )
  const series = useMemo(() => toPeriodTotalsSeries(groups), [groups])
  const pageTotal = useMemo(() => items.reduce((sum, e) => sum + e.amount, 0), [items])

  function refreshAll() {
    refresh()
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.pending() })
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.budgets(NOW_MONTH) })
  }

  const totalPages = Math.ceil(total / EXPENSE_PAGE_LIMIT)

  return (
    <AppShell>
      <Header
        title={t.expenses}
        backTo={ROUTES.DASHBOARD}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)} aria-label={t.recordExpense}>
            <Plus size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer variant="list" className="space-y-6">
        <ExpensesOverview month={NOW_MONTH} onPendingResolved={refreshAll} />

        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchExpenses}
            aria-label={t.expenses}
          />
        </div>

        <ExpenseFilterBar
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          thisMonthOnly={thisMonthOnly}
          onThisMonthChange={setThisMonthOnly}
          onManageCategories={() => navigate(ROUTES.EXPENSE_CATEGORIES)}
        />

        {/* Loading */}
        {status === 'loading' && (
          <div className="expense-skeleton" aria-busy="true">
            {['sk-1', 'sk-2', 'sk-3', 'sk-4'].map((k) => <div key={k} className="expense-skeleton__card" />)}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState title={t.couldNotLoadExpenses} message={t.checkConnectionRetry} onRetry={refresh} />
        )}

        {/* Empty — nothing recorded vs nothing matching the filters */}
        {status === 'success' && items.length === 0 && (
          search || categoryFilter || thisMonthOnly
            ? <EmptyState title={t.noResults} description={t.tryDifferentSearch} />
            : (
              <EmptyState
                icon={<Receipt size={40} aria-hidden="true" />}
                title={t.noExpensesRecorded}
                description={t.startTrackingExpenses}
                action={
                  <Button variant="primary" size="md" onClick={() => setDrawerOpen(true)}>
                    {t.recordFirstExpense}
                  </Button>
                }
              />
            )
        )}

        {/* Success */}
        {status === 'success' && items.length > 0 && (
          <>
            {groups.map((group) => (
              <PeriodGroup key={group.key} group={group}>
                {group.items.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </PeriodGroup>
            ))}

            <ListTotalsFooter label={t.totalExpenses} totalPaise={pageTotal} series={series} />
          </>
        )}

        {totalPages > 1 && (
          <div className="expense-pagination">
            <Button variant="none" type="button" className="expense-pagination__btn" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t.previousPage}>{t.back}</Button>
            <span className="expense-pagination__info">{t.pageXOfY} {page} {t.ofLabel} {totalPages}</span>
            <Button variant="none" type="button" className="expense-pagination__btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label={t.nextPage}>{t.next}</Button>
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
