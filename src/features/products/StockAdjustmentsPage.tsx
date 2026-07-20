/** Stock Adjustments — Page (lazy loaded), mockup #48.
 *
 * The business-wide log of manual stock corrections: search → direction chips →
 * rows carrying a signed delta. Making an adjustment still happens on a
 * product, so the "+" sends you to the product list to pick one.
 */

import { Search, Plus, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useStockAdjustments } from './useStockAdjustments'
import { AdjustmentRow } from './components/AdjustmentRow'
import type { AdjustmentFilter } from './adjustments.types'
import './adjustments.css'

export default function StockAdjustmentsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const {
    adjustments, status, refetch,
    search, setSearch, filter, setFilter,
    hasMore, isLoadingMore, loadMore,
  } = useStockAdjustments()

  const chips: FilterChipOption<AdjustmentFilter>[] = [
    { value: 'ALL', label: t.all },
    { value: 'ADJUSTMENT_IN', label: t.stockIn },
    { value: 'ADJUSTMENT_OUT', label: t.stockOut },
  ]

  return (
    <AppShell>
      <Header
        title={t.stockAdjustmentTitle}
        backTo={ROUTES.PRODUCTS}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.PRODUCTS)}
            aria-label={t.newAdjustment}
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
            placeholder={t.searchAdjustments}
            aria-label={t.searchAdjustments}
          />
        </div>

        <FilterChips
          options={chips}
          value={filter}
          onChange={setFilter}
          label={t.filterAdjustments}
        />

        {/* Loading */}
        {status === 'pending' && (
          <div className="adjustment-list" aria-busy="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="adjustment-row">
                <Skeleton height="2.5rem" width="100%" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadAdjustments}
            message={t.checkConnectionRetry}
            onRetry={refetch}
          />
        )}

        {/* Empty */}
        {status === 'success' && adjustments.length === 0 && (
          <EmptyState
            icon={<SlidersHorizontal size={40} aria-hidden="true" />}
            title={search || filter !== 'ALL' ? t.noResults : t.noAdjustmentsYet}
            description={
              search || filter !== 'ALL' ? t.tryDifferentSearch : t.noAdjustmentsYetDesc
            }
          />
        )}

        {/* Success */}
        {status === 'success' && adjustments.length > 0 && (
          <>
            <div className="adjustment-list stagger-list" role="list" aria-label={t.stockAdjustmentTitle}>
              {adjustments.map((adjustment) => (
                <AdjustmentRow
                  key={adjustment.id}
                  adjustment={adjustment}
                  onOpen={(id) => navigate(ROUTES.PRODUCT_DETAIL.replace(':id', id))}
                />
              ))}
            </div>

            {hasMore && (
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={loadMore}
                loading={isLoadingMore}
              >
                {t.loadMore}
              </Button>
            )}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
