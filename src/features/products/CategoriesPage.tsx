/** Categories — Page (lazy loaded), mockup #53.
 *
 * Search → tinted category rows with a product count → tap opens the products
 * list filtered to that category. Header "+" creates one. 4 UI states.
 */

import { Search, Plus, Tag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useCategories } from './useCategories'
import { CategoryRow } from './components/CategoryRow'
import { CategoryFormDrawer } from './components/CategoryFormDrawer'
import './categories.css'

export default function CategoriesPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const {
    categories, totalCount, status, refetch,
    search, setSearch, editing, setEditing, save, isSaving,
  } = useCategories()

  return (
    <AppShell>
      <Header
        title={t.categories}
        backTo={ROUTES.PRODUCTS}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing('new')}
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
          <div className="category-list" aria-busy="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="category-row">
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
            icon={<Tag size={40} aria-hidden="true" />}
            title={totalCount === 0 ? t.noCategoriesYet : t.noResults}
            description={totalCount === 0 ? t.noCategoriesYetDesc : t.tryDifferentSearch}
            action={
              totalCount === 0 ? (
                <Button variant="primary" size="md" onClick={() => setEditing('new')}>
                  {t.addCategory}
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Success */}
        {status === 'success' && categories.length > 0 && (
          <div className="category-list stagger-list" role="list" aria-label={t.categories}>
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onOpen={(id) => navigate(`${ROUTES.PRODUCTS}?categoryId=${id}`)}
                onRename={setEditing}
              />
            ))}
          </div>
        )}
      </PageContainer>

      <CategoryFormDrawer
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={save}
        isSaving={isSaving}
      />
    </AppShell>
  )
}
