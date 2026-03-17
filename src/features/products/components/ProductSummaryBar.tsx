/** Product list — Hero card pair (Stock Value / Low Stock Alert)
 *
 * Matches dashboard hero pattern: teal card (value) + amber card (alert).
 * Unique to products: stock value is the hero metric, low stock count is the alert.
 */

import React from 'react'
import { ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatProductPrice } from '../product.utils'
import type { ProductListResponse } from '../product.types'
import './ProductSummaryBar.css'

interface ProductSummaryBarProps {
  summary: ProductListResponse['summary']
  onStockClick?: () => void
  onLowStockClick?: () => void
}

export const ProductSummaryBar: React.FC<ProductSummaryBarProps> = ({
  summary,
  onStockClick,
  onLowStockClick,
}) => {
  const { totalProducts, lowStockCount, totalStockValue } = summary

  return (
    <div className="product-hero" role="list" aria-label="Inventory summary">
      <p className="product-hero-count">{totalProducts} Products</p>

      <div className="product-hero-cards">
        {/* Stock Value — teal gradient */}
        <button
          className="product-hero-card product-hero-card--value"
          role="listitem"
          onClick={onStockClick}
          aria-label={`Total stock value: ${formatProductPrice(totalStockValue)}`}
        >
          <div className="product-hero-card-content">
            <span className="product-hero-amount">{formatProductPrice(totalStockValue)}</span>
            <span className="product-hero-label">
              Stock Value
              <TrendingUp size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="product-hero-chevron" />
        </button>

        {/* Low Stock Alert — amber/warning */}
        <button
          className={`product-hero-card product-hero-card--alert${lowStockCount === 0 ? ' product-hero-card--safe' : ''}`}
          role="listitem"
          onClick={onLowStockClick}
          aria-label={lowStockCount > 0 ? `${lowStockCount} products low on stock` : 'All products stocked'}
        >
          <div className="product-hero-card-content">
            <span className="product-hero-amount">{lowStockCount}</span>
            <span className="product-hero-label">
              {lowStockCount > 0 ? 'Low Stock' : 'All Stocked'}
              <AlertTriangle size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="product-hero-chevron product-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
