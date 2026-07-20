/** Products — search + chip filter row (GPT mockup).
 *
 * Search field with a camera (scan) button, then five chips:
 * All · Favorites · Low Stock · Categories · Filters. Category/Filters open
 * bottom-sheets; Favorites is coming-soon; All/Low Stock toggle the list.
 */

import React from 'react'
import { Search, Camera, List, Star, AlertTriangle, Folder, Filter } from 'lucide-react'
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
    <div className="product-filter-bar">
      <div className="search-bar search-bar--pill search-bar--action">
        <Search size={18} aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchProductsPlaceholder}
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

      <div className="product-chips" role="group" aria-label={t.filters}>
        <Button
          variant="none"
          className={`product-chip${mode === 'all' && !categoryActive ? ' product-chip--on' : ''}`}
          onClick={onSelectAll}
          aria-pressed={mode === 'all' && !categoryActive}
        >
          <List size={15} aria-hidden="true" />
          {t.all}
        </Button>

        <Button variant="none" className="product-chip" onClick={onFavorites}>
          <Star size={15} aria-hidden="true" />
          {t.favorites}
        </Button>

        <Button
          variant="none"
          className={`product-chip${mode === 'low' ? ' product-chip--on' : ''}`}
          onClick={onLowStock}
          aria-pressed={mode === 'low'}
        >
          <AlertTriangle size={15} aria-hidden="true" />
          {t.lowStock}
          {typeof lowStockCount === 'number' && lowStockCount > 0 && (
            <span className="product-chip-count" aria-hidden="true">{lowStockCount}</span>
          )}
        </Button>

        <Button
          variant="none"
          className={`product-chip${categoryActive ? ' product-chip--on' : ''}`}
          onClick={onOpenCategories}
        >
          <Folder size={15} aria-hidden="true" />
          {t.categories}
        </Button>

        <Button
          variant="none"
          className={`product-chip${filtersActive ? ' product-chip--on' : ''}`}
          onClick={onOpenFilters}
        >
          <Filter size={15} aria-hidden="true" />
          {t.filters}
        </Button>
      </div>
    </div>
  )
}
