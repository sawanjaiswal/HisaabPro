/** StockSummaryEmpty — empty states (no products at all, or filters returned nothing) */

import { Package, X } from 'lucide-react'

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
  if (hasActiveFilters) {
    return (
      <div className="report-empty" role="status">
        <div className="report-empty-icon" aria-hidden="true">
          <Package size={28} />
        </div>
        <p className="report-empty-title">No products match your filters</p>
        <p className="report-empty-desc">
          Try adjusting your search or filter to find what you are looking for.
        </p>
        <button
          className="btn btn-secondary btn-md"
          type="button"
          onClick={onClearFilters}
          aria-label="Clear all filters"
        >
          <X size={16} aria-hidden="true" />
          Clear Filters
        </button>
      </div>
    )
  }

  return (
    <div className="report-empty" role="status">
      <div className="report-empty-icon" aria-hidden="true">
        <Package size={28} />
      </div>
      <p className="report-empty-title">No products yet</p>
      <p className="report-empty-desc">
        No products added yet. Add your first product to track stock levels.
      </p>
      <button
        className="btn btn-primary btn-md"
        type="button"
        onClick={onNavigateNew}
        aria-label="Add a product"
      >
        Add Product
      </button>
    </div>
  )
}
