/** Expense Details — Page (lazy loaded), mockup #13.
 *
 * Single scroll: hero card → info rows → bill/receipt → Edit + Delete.
 * Edit reopens the shared expense drawer in edit mode instead of routing to
 * a second form, so there is one expense form in the app, not two.
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Receipt, ExternalLink } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useExpenseDetail } from '../useExpenseDetail'
import { useExpenseCategoryList } from '../useExpenseCategoryList'
import { ExpenseDetailRows } from '../components/ExpenseDetailRows'
import { AddExpenseDrawer } from '../components/AddExpenseDrawer'
import '../expense-detail.css'

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const expenseId = id ?? ''
  const { expense, status, refresh, handleDelete } = useExpenseDetail(expenseId)
  const categories = useExpenseCategoryList()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <AppShell>
        <Header title={t.expenseDetailsTitle} backTo={ROUTES.EXPENSES} />

        <PageContainer variant="detail" className="space-y-6">
          {/* Loading */}
          {status === 'loading' && (
            <div className="expense-skeleton" aria-busy="true">
              {['sk-1', 'sk-2', 'sk-3'].map((k) => <div key={k} className="expense-skeleton__card" />)}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadExpenses}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {/* Not found */}
          {status === 'success' && !expense && (
            <EmptyState
              icon={<Receipt size={40} aria-hidden="true" />}
              title={t.expenseNotFound}
              description={t.expenseNotFoundDesc}
              action={
                <Button variant="primary" size="md" onClick={() => navigate(ROUTES.EXPENSES)}>
                  {t.expenses}
                </Button>
              }
            />
          )}

          {/* Success */}
          {status === 'success' && expense && (
            <div className="stagger-enter space-y-6">
              <ExpenseDetailRows expense={expense} />

              {expense.receiptUrl && (
                <a
                  className="expense-detail-receipt"
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    className="expense-detail-receipt__thumb"
                    src={expense.receiptUrl}
                    alt={t.billReceiptLabel}
                  />
                  <span className="expense-detail-receipt__main">
                    <span className="expense-detail-receipt__title">{t.billReceiptLabel}</span>
                    <span className="expense-detail-receipt__hint">{t.openFullImage}</span>
                  </span>
                  <ExternalLink size={18} aria-hidden="true" />
                </a>
              )}

              <div className="expense-detail-actions">
                <Button variant="outline" size="md" onClick={() => setEditOpen(true)}>
                  {t.editExpense}
                </Button>
                <Button variant="destructive" size="md" onClick={() => setDeleteOpen(true)}>
                  {t.delete}
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </AppShell>

      {expense && (
        <AddExpenseDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onCreated={refresh}
          categories={categories}
          expense={expense}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); handleDelete() }}
        title={t.deleteExpenseTitle}
        description={t.deleteExpenseDesc}
      />
    </>
  )
}
