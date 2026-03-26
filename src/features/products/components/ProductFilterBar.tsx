/** Product list — search + category pill filter bar */

import React from 'react'
import { Search } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PREDEFINED_CATEGORIES } from '../product.constants'

interface ProductFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeCategoryId: string | 'ALL'
  onCategoryChange: (categoryId: string | 'ALL') => void
}

export const ProductFilterBar: React.FC<ProductFilterBarProps> = ({
  search,
  onSearchChange,
  activeCategoryId,
  onCategoryChange,
}) => {
  const { t } = useLanguage()

  return (
    <div className="product-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByNameOrSku}
          aria-label={t.searchProducts}
        />
      </div>

      <div className="pill-tabs" role="group" aria-label={t.filterProductsByCategory}>
        <button
          key="ALL"
          className={`pill-tab${activeCategoryId === 'ALL' ? ' active' : ''}`}
          onClick={() => onCategoryChange('ALL')}
          aria-pressed={activeCategoryId === 'ALL'}
          aria-label={t.showAllProducts}
        >
          {t.all}
        </button>
        {PREDEFINED_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`pill-tab${activeCategoryId === cat.id ? ' active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
            aria-pressed={activeCategoryId === cat.id}
            aria-label={`${t.showCatProducts} ${cat.name} ${t.productsLabel}`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
