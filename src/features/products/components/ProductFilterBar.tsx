/** Product list — search + category pill filter bar */

import React from 'react'
import { Search } from 'lucide-react'
import { PREDEFINED_CATEGORIES } from '../product.constants'

interface ProductFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeCategoryId: string | 'ALL'
  onCategoryChange: (categoryId: string | 'ALL') => void
}

const ALL_OPTION = { id: 'ALL', name: 'All' }

export const ProductFilterBar: React.FC<ProductFilterBarProps> = ({
  search,
  onSearchChange,
  activeCategoryId,
  onCategoryChange,
}) => {
  return (
    <div className="product-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or SKU..."
          aria-label="Search products by name or SKU"
        />
      </div>

      <div className="pill-tabs" role="group" aria-label="Filter products by category">
        <button
          key={ALL_OPTION.id}
          className={`pill-tab${activeCategoryId === ALL_OPTION.id ? ' active' : ''}`}
          onClick={() => onCategoryChange('ALL')}
          aria-pressed={activeCategoryId === ALL_OPTION.id}
          aria-label="Show all products"
        >
          {ALL_OPTION.name}
        </button>
        {PREDEFINED_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`pill-tab${activeCategoryId === cat.id ? ' active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
            aria-pressed={activeCategoryId === cat.id}
            aria-label={`Show ${cat.name} products`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
