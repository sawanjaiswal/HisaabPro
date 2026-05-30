/** Product list — search + category pill filter bar */

import React from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PREDEFINED_CATEGORIES } from '../product.constants'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface ProductFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeCategoryId: string | 'ALL'
  onCategoryChange: (categoryId: string | 'ALL') => void
  lowStockOnly?: boolean
  onLowStockToggle?: (value: boolean) => void
  lowStockCount?: number
}

export const ProductFilterBar: React.FC<ProductFilterBarProps> = ({
  search,
  onSearchChange,
  activeCategoryId,
  onCategoryChange,
  lowStockOnly = false,
  onLowStockToggle,
  lowStockCount,
}) => {
  const { t } = useLanguage()

  return (
    <div className="product-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByNameOrSku}
          aria-label={t.searchProducts}
        />
      </div>

      <div className="pill-tabs" role="group" aria-label={t.filterProductsByCategory}>
        <Button variant="none"
          key="ALL"
          className={`pill-tab${activeCategoryId === 'ALL' ? ' active' : ''}`}
          onClick={() => onCategoryChange('ALL')}
          aria-pressed={activeCategoryId === 'ALL'}
          aria-label={t.showAllProducts}
        >
          {t.all}
        </Button>
        {onLowStockToggle && (
          <Button variant="none"
            key="LOW_STOCK"
            className={`pill-tab${lowStockOnly ? ' active' : ''}`}
            onClick={() => onLowStockToggle(!lowStockOnly)}
            aria-pressed={lowStockOnly}
            aria-label={lowStockOnly ? t.showAllProducts : t.lowStockOnly}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} aria-hidden="true" />
              {t.lowStockOnly}
              {typeof lowStockCount === 'number' && lowStockCount > 0 && (
                <span className="pill-tab-badge" aria-hidden="true">{lowStockCount}</span>
              )}
            </span>
          </Button>
        )}
        {PREDEFINED_CATEGORIES.map((cat) => (
          <Button variant="none"
            key={cat.id}
            className={`pill-tab${activeCategoryId === cat.id ? ' active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
            aria-pressed={activeCategoryId === cat.id}
            aria-label={`${t.showCatProducts} ${cat.name} ${t.productsLabel}`}
          >
            {cat.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
