/** Expense Categories — Page (lazy loaded), mockup #50.
 *
 * Search → rows carrying the category and how many expenses sit under it.
 * Opening a row lands on the expense list already filtered to that category,
 * which is the only thing a category is for.
 *
 * Renaming is absent on purpose: the API exposes create and list only, and a
 * disabled control would read as a bug rather than a boundary.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Receipt } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useExpenseCategories } from '../useExpenseCategories'
import { ExpenseCategoryRow } from '../components/ExpenseCategoryRow'
import '../expense-categories.css'

export default function ExpenseCategoriesPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const {
    categories, totalCount, status, refetch,
    search, setSearch, creating, setCreating, create, isSaving,
  } = useExpenseCategories()

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t.categoryNameRequired)
      return
    }
    create(trimmed)
    setName('')
  }

  return (
    <AppShell>
      <Header
        title={t.expenseCategories}
        backTo={ROUTES.EXPENSES}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setName(''); setError(null); setCreating(true) }}
            aria-label={t.addCategory}
          >
            <Plus size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer variant="list" className="space-y-6">
        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchCategories}
            aria-label={t.searchCategories}
          />
        </div>

        {/* Loading */}
        {status === 'pending' && (
          <div className="expense-category-list" aria-busy="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="expense-category-row">
                <Skeleton height="2.5rem" width="100%" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadCategories}
            message={t.checkConnectionRetry}
            onRetry={refetch}
          />
        )}

        {/* Empty */}
        {status === 'success' && categories.length === 0 && (
          <EmptyState
            icon={<Receipt size={40} aria-hidden="true" />}
            title={totalCount === 0 ? t.noCategoriesYet : t.noResults}
            description={totalCount === 0 ? t.noCategoriesYetDesc : t.tryDifferentSearch}
          />
        )}

        {/* Success */}
        {status === 'success' && categories.length > 0 && (
          <div className="expense-category-list stagger-list" role="list" aria-label={t.expenseCategories}>
            {categories.map((category) => (
              <ExpenseCategoryRow
                key={category.id}
                category={category}
                onOpen={(id) => navigate(`${ROUTES.EXPENSES}?categoryId=${id}`)}
              />
            ))}
          </div>
        )}
      </PageContainer>

      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title={t.addCategory}
        size="sm"
        footer={
          <div className="expense-category-form-actions">
            <Button variant="outline" size="md" onClick={() => setCreating(false)} disabled={isSaving}>
              {t.cancel}
            </Button>
            <Button variant="primary" size="md" onClick={submit} loading={isSaving}>
              {t.save}
            </Button>
          </div>
        }
      >
        <Input
          label={t.categoryName}
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder={t.categoryNamePlaceholder}
          error={error ?? undefined}
          autoFocus
        />
      </Drawer>
    </AppShell>
  )
}
