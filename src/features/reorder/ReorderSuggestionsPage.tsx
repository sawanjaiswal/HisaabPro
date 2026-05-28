/** Smart inventory (#148) — velocity-based reorder suggestions.
 *
 * Deterministic: suggested qty = sales-velocity × (lead time + coverage) −
 * current stock. Reuses the #146 velocity math. 4 UI states. */

import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useReorderSuggestions } from './hooks/useReorderSuggestions'
import { ReorderSummary } from './components/ReorderSummary'
import { ReorderRow } from './components/ReorderRow'
import './reorder.css'

export default function ReorderSuggestionsPage() {
  const { t } = useLanguage()
  const [onlyNeeded, setOnlyNeeded] = useState(true)
  const { data, isLoading, isError, refetch } = useReorderSuggestions(onlyNeeded)

  const items = data?.items ?? []
  const isEmpty = !isLoading && !isError && items.length === 0

  return (
    <AppShell>
      <Header title={t.reorderSuggestions} backTo={ROUTES.MORE} />
      <PageContainer variant="list" className="space-y-6">
        <div className="reorder-tabs" role="group" aria-label={t.reorderFilter}>
          <button
            type="button"
            className={`reorder-tab${onlyNeeded ? ' reorder-tab--active' : ''}`}
            onClick={() => setOnlyNeeded(true)}
            aria-pressed={onlyNeeded}
          >
            {t.reorderNeeded}
          </button>
          <button
            type="button"
            className={`reorder-tab${!onlyNeeded ? ' reorder-tab--active' : ''}`}
            onClick={() => setOnlyNeeded(false)}
            aria-pressed={!onlyNeeded}
          >
            {t.reorderAll}
          </button>
        </div>

        {isLoading && (
          <div className="space-y-6" aria-busy="true">
            <Skeleton height="92px" borderRadius="var(--radius-xl)" />
            <Skeleton height="240px" borderRadius="var(--radius-xl)" />
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState
            title={t.couldNotLoadReorder}
            message={t.checkConnectionRetry}
            onRetry={() => refetch()}
          />
        )}

        {isEmpty && (
          <EmptyState
            icon={<PackageCheck size={32} aria-hidden="true" />}
            title={onlyNeeded ? t.reorderAllStockedTitle : t.reorderEmptyTitle}
            description={onlyNeeded ? t.reorderAllStockedDesc : t.reorderEmptyDesc}
          />
        )}

        {!isLoading && !isError && !isEmpty && data && (
          <>
            <ReorderSummary summary={data.summary} />
            <ul className="reorder-list stagger-list">
              {items.map((item) => (
                <ReorderRow key={item.productId} item={item} />
              ))}
            </ul>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
