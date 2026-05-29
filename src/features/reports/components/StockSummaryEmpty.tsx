/** StockSummaryEmpty — empty states (no products at all, or filters returned nothing) */

import { Package, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

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
  const { t } = useLanguage()
    return (
      <div className="report-empty" role="status">
        <div className="report-empty-icon" aria-hidden="true">
          <Package size={28} />
        </div>
        <p className="report-empty-title">{t.noProductsMatchFilters}</p>
        <p className="report-empty-desc">
          {t.tryAdjustingSearchFilter}
        </p>
        <Button
          variant="secondary" size="md"
          type="button"
          onClick={onClearFilters}
          aria-label={t.clearAllFilters}
        >
          <X size={16} aria-hidden="true" />
          Clear Filters
        </Button>
      </div>
    )
  }

  return (
    <div className="report-empty" role="status">
      <div className="report-empty-icon" aria-hidden="true">
        <Package size={28} />
      </div>
      <p className="report-empty-title">{t.noProducts}</p>
      <p className="report-empty-desc">
        {t.noProductsAddedYet}
      </p>
      <Button
        variant="primary" size="md"
        type="button"
        onClick={onNavigateNew}
        aria-label={t.addAProduct}
      >
        Add Product
      </Button>
    </div>
  )
}
