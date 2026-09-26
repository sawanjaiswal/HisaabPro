/** Products — search + chip filter row (GPT mockup).
 *
 * Search field with a camera (scan) button, then five chips:
 * All · Favorites · Low Stock · Categories · Filters. Category/Filters open
 * bottom-sheets; Favorites is coming-soon; All/Low Stock toggle the list.
 */

import React from 'react'
import { Search, Camera, Filter } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'
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
    <div className="party-filter-bar product-filter-bar">
      <div className="party-search-row product-search-row">
        <div className="search-bar search-bar--pill search-bar--action">
          <Search size={20} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchProductsPlaceholder ?? 'Search by name or SKU...'}
            aria-label={t.searchProducts}
          />
          <Button
            variant="none"
            className="search-bar__action"
            onClick={onScan}
            aria-label={t.scanBarcode}
          >
            <Camera size={20} aria-hidden="true" />
          </Button>
        </div>
        <Button
          variant="none"
          className={`party-filter-icon-btn${filtersActive ? ' party-filter-icon-btn--active' : ''}`}
          onClick={onOpenFilters}
          aria-label={t.filters}
        >
          <Filter size={20} aria-hidden="true" />
        </Button>
      </div>

      <div className="type-chips product-chips" role="group" aria-label={t.filters}>
        <Button
          variant="none"
          className={`type-chip${mode === 'all' && !categoryActive ? ' type-chip--on' : ''}`}
          onClick={onSelectAll}
          aria-pressed={mode === 'all' && !categoryActive}
        >
          {t.all}
        </Button>

        <Button
          variant="none"
          className={`type-chip${mode === 'low' ? ' type-chip--on' : ''}`}
          onClick={onLowStock}
          aria-pressed={mode === 'low'}
        >
          {t.lowStock}
          {typeof lowStockCount === 'number' && lowStockCount > 0 && (
            <span className="type-chip-count">{lowStockCount}</span>
          )}
        </Button>

        <Button
          variant="none"
          className={`type-chip${categoryActive ? ' type-chip--on' : ''}`}
          onClick={onOpenCategories}
        >
          {t.categories}
        </Button>

        <Button variant="none" className="type-chip" onClick={onFavorites}>
          {t.favorites}
        </Button>
      </div>
    </div>
  )
}
