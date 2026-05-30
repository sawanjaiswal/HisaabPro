/** StockSummaryEmpty — empty states (no products at all, or filters returned nothing) */

import { Package, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'

interface StockSummaryEmptyProps {
  hasActiveFilters: boolean
  onNavigateNew: () => void
  onClearFilters: () => void
}

export function StockSummaryEmpty({
  hasActiveFilters,
  onNavigateNew,
  onClearFilters,
}: StockSummaryEmptyProps) {
  const { t } = useLanguage()

  if (hasActiveFilters) {
    return (
      <EmptyState
        icon={<Package size={22} aria-hidden="true" />}
        title={t.noProductsMatchFilters}
        description={t.tryAdjustingSearchFilter}
        action={
          <Button
            variant="secondary" size="md"
            type="button"
            onClick={onClearFilters}
            aria-label={t.clearAllFilters}
          >
            <X size={16} aria-hidden="true" />
            Clear Filters
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={<Package size={22} aria-hidden="true" />}
      title={t.noProducts}
      description={t.noProductsAddedYet}
      action={
        <Button
          variant="primary" size="md"
          type="button"
          onClick={onNavigateNew}
          aria-label={t.addAProduct}
        >
          Add Product
        </Button>
      }
    />
  )
}
