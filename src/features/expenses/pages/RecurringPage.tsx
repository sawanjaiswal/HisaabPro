/** RecurringPage — List and manage recurring expense templates */

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Repeat } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { queryKeys } from '@/lib/query-keys'
import { listTemplates } from '../services/recurring.service'
import { listExpenseCategories } from '../expense.service'
import { RecurringTemplateCard, RecurringCardSkeleton } from '../components/RecurringTemplateCard'
import { AddRecurringDrawer } from '../components/AddRecurringDrawer'
import type { ExpenseCategory, RecurringTemplate } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'
import '../expenses.css'
import '../expenses-upgrade.css'

export default function RecurringPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<RecurringTemplate | undefined>()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    listExpenseCategories(ctrl.signal).then(setCategories).catch(() => {})
    return () => ctrl.abort()
  }, [])

  const query = useQuery({
    queryKey: queryKeys.expenses.templates(),
    queryFn: ({ signal }) => listTemplates(signal),
  })

  function onSaved() {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.templates() })
    setDrawerOpen(false)
  }

  function onDeleted() {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.templates() })
  }

  function openEdit(tmpl: RecurringTemplate) {
    setEditTemplate(tmpl)
    setDrawerOpen(true)
  }

  function openAdd() {
    setEditTemplate(undefined)
    setDrawerOpen(true)
  }

  const title = t.expensesRecurringTitle ?? 'Recurring Expenses'

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.EXPENSES} />
      <PageContainer className="space-y-6">

        {query.isPending && (
          <div aria-busy="true" className="space-y-2">
            {[0, 1, 2].map((i) => <RecurringCardSkeleton key={i} />)}
          </div>
        )}

        {query.isError && (
          <ErrorState
            title="Could not load. Tap to retry."
            message="Check your connection."
            onRetry={() => query.refetch()}
          />
        )}

        {!query.isPending && !query.isError && (
          <>
            {(query.data ?? []).length === 0 ? (
              <div className="expense-empty">
                <div className="expense-empty__icon" aria-hidden="true"><Repeat size={32} /></div>
                <p className="expense-empty__title">
                  {t.expensesRecurringEmpty ?? 'No recurring expenses'}
                </p>
                <p className="expense-empty__desc">
                  Set up rent, salaries, subscriptions — confirm or skip each month.
                </p>
                <button type="button" className="expense-add-btn" onClick={openAdd}>
                  <Plus size={14} aria-hidden="true" /> {t.expensesRecurringAddAction ?? 'Add Recurring Expense'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(query.data ?? []).map((tmpl) => (
                  <RecurringTemplateCard
                    key={tmpl.id}
                    template={tmpl}
                    onEdit={openEdit}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {(query.data ?? []).length > 0 && (
          <button type="button" className="expense-add-btn" onClick={openAdd} style={{ marginTop: '0.5rem' }}>
            <Plus size={14} aria-hidden="true" /> {t.expensesRecurringAddAction ?? 'Add Recurring'}
          </button>
        )}
      </PageContainer>

      <AddRecurringDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={onSaved}
        categories={categories}
        existing={editTemplate}
      />
    </AppShell>
  )
}
