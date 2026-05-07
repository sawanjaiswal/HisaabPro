/** PendingExpensesPage — Full list of pending-confirmation expenses */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { queryKeys } from '@/lib/query-keys'
import { listPendingExpenses } from '../expense.service'
import { PendingExpenseCard, PendingCardSkeleton } from '../components/PendingExpenseCard'
import { useLanguage } from '@/hooks/useLanguage'
import '../expenses.css'
import '../expenses-upgrade.css'

export default function PendingExpensesPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.expenses.pending(),
    queryFn: ({ signal }) => listPendingExpenses(signal),
  })

  function onDone() {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.pending() })
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() })
  }

  const title = t.expensesPending ?? 'Pending Confirmations'

  if (query.isPending) {
    return (
      <AppShell>
        <Header title={title} backTo={ROUTES.EXPENSES} />
        <PageContainer className="space-y-3">
          {[0, 1, 2].map((i) => <PendingCardSkeleton key={i} />)}
        </PageContainer>
      </AppShell>
    )
  }

  if (query.isError) {
    return (
      <AppShell>
        <Header title={title} backTo={ROUTES.EXPENSES} />
        <PageContainer>
          <ErrorState
            title="Could not load pending expenses"
            message="Check your connection and try again."
            onRetry={() => query.refetch()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const items = query.data ?? []

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.EXPENSES} />
      <PageContainer className="space-y-3">
        {items.length === 0 ? (
          <div className="expense-empty">
            <div className="expense-empty__icon" aria-hidden="true">
              <Clock size={32} />
            </div>
            <p className="expense-empty__title">
              {t.expensesPendingEmpty ?? 'No pending expenses'}
            </p>
            <p className="expense-empty__desc">
              Recurring expenses that need confirmation will appear here.
            </p>
          </div>
        ) : (
          <>
            <p className="pending-page__count">{items.length} expense{items.length !== 1 ? 's' : ''} awaiting confirmation</p>
            <div className="space-y-2">
              {items.map((item) => (
                <PendingExpenseCard key={item.id} item={item} onDone={onDone} />
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
