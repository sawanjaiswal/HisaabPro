/** Products — search + chip filter row (GPT mockup).
 *
 * Search field with a camera (scan) button, then five chips:
 * All · Favorites · Low Stock · Categories · Filters. Category/Filters open
 * bottom-sheets; Favorites is coming-soon; All/Low Stock toggle the list.
 */

import React from 'react'
import { Camera, Filter } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'

interface ProductFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  onScan: () => void
  /** Which toggle chip is active: 'all' (no filter) or 'low' (low-stock only). */
  mode: 'all' | 'low'
  categoryActive: boolean
  filtersActive: boolean
  lowStockCount?: number
  onSelectAll: () => void
  onFavorites: () => void
  onLowStock: () => void
  onOpenCategories: () => void
  onOpenFilters: () => void
}

export const ProductFilterBar: React.FC<ProductFilterBarProps> = ({
  search,
  onSearchChange,
  onScan,
  mode,
  categoryActive,
  filtersActive,
  lowStockCount,
  onSelectAll,
  onFavorites,
  onLowStock,
  onOpenCategories,
  onOpenFilters,
}) => {
  const { t } = useLanguage()

  return (
    <div className="product-filter-bar">
      <div className="product-search-row">
        <SearchInput
          variant="pill"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
          placeholder={t.searchProductsPlaceholder ?? 'Search by name or SKU...'}
          aria-label={t.searchProducts}
          trailing={
            <Button
              variant="none"
              type="button"
              className="search-input-btn"
              onClick={onScan}
              aria-label={t.scanBarcode}
            >
              <Camera size={20} aria-hidden="true" />
            </Button>
          }
        />
        <Button
          variant="none"
          className={`product-filter-icon-btn${filtersActive ? ' product-filter-icon-btn--active' : ''}`}
          onClick={onOpenFilters}
          aria-label={t.filters}
        >
          <Filter size={20} aria-hidden="true" />
        </Button>
      </div>

      <div className="product-chips" role="group" aria-label={t.filters}>
        <Button
          variant="none"
          className={`product-chip${mode === 'all' && !categoryActive ? ' product-chip--on' : ''}`}
          onClick={onSelectAll}
          aria-pressed={mode === 'all' && !categoryActive}
        >
          {t.all}
        </Button>

        <Button
          variant="none"
          className={`product-chip${mode === 'low' ? ' product-chip--on' : ''}`}
          onClick={onLowStock}
          aria-pressed={mode === 'low'}
        >
          {t.lowStock}
          {typeof lowStockCount === 'number' && lowStockCount > 0 && (
            <span className="product-chip-count">{lowStockCount}</span>
          )}
        </Button>

        <Button
          variant="none"
          className={`product-chip${categoryActive ? ' product-chip--on' : ''}`}
          onClick={onOpenCategories}
          aria-pressed={categoryActive}
        >
          {t.categories}
        </Button>

        <Button variant="none" className="product-chip" onClick={onFavorites}>
          {t.favorites}
        </Button>
      </div>
    </div>
  )
}
