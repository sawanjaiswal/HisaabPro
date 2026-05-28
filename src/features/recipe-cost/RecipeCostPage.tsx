/** Recipe Cost Dashboard (V3) — derives cost-per-unit + margin from BOM data.
 *
 * Read-only. For restaurant / bakery / manufacturing verticals. 4 UI states. */

import { ChefHat, AlertTriangle, TrendingDown } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useRecipeCost } from './hooks/useRecipeCost'
import { RecipeCostCard } from './components/RecipeCostCard'
import { sortByActionability } from './recipe-cost.utils'
import './recipe-cost.css'

export default function RecipeCostPage() {
  const { t } = useLanguage()
  const { data, isLoading, isError, refetch } = useRecipeCost()

  const recipes = data ? sortByActionability(data.recipes) : []
  const isEmpty = !isLoading && !isError && recipes.length === 0

  return (
    <AppShell>
      <Header title={t.recipeCostTitle} backTo={ROUTES.MORE} />
      <PageContainer variant="list" className="space-y-6">
        {isLoading && (
          <div className="space-y-6" aria-busy="true">
            <Skeleton height="200px" borderRadius="var(--radius-xl)" />
            <Skeleton height="200px" borderRadius="var(--radius-xl)" />
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState
            title={t.recipeCostError}
            message={t.checkConnectionRetry}
            onRetry={() => refetch()}
          />
        )}

        {isEmpty && (
          <EmptyState
            icon={<ChefHat size={32} aria-hidden="true" />}
            title={t.recipeCostEmptyTitle}
            description={t.recipeCostEmptyDesc}
          />
        )}

        {!isLoading && !isError && !isEmpty && data && (
          <>
            {(data.lossMakingCount > 0 || data.incompleteCount > 0) && (
              <div className="recipe-cost-summary">
                {data.lossMakingCount > 0 && (
                  <span className="recipe-cost-summary__chip recipe-cost-summary__chip--loss">
                    <TrendingDown size={14} aria-hidden="true" />
                    {data.lossMakingCount} {t.recipeLossMakingShort}
                  </span>
                )}
                {data.incompleteCount > 0 && (
                  <span className="recipe-cost-summary__chip recipe-cost-summary__chip--warn">
                    <AlertTriangle size={14} aria-hidden="true" />
                    {data.incompleteCount} {t.recipeIncompleteShort}
                  </span>
                )}
              </div>
            )}
            {recipes.map((r) => (
              <RecipeCostCard key={r.bomId} recipe={r} />
            ))}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
