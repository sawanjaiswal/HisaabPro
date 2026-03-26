/** Product list — Hero card pair (Stock Value / Low Stock Alert)
 *
 * Uses shared summary-hero CSS pattern.
 * Teal card (value) + amber card (alert) / lime card (safe).
 */

import React from 'react'
import { ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatProductPrice } from '../product.utils'
import type { ProductListResponse } from '../product.types'

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
  const { t } = useLanguage()
  const { totalProducts, lowStockCount, totalStockValue } = summary

  return (
    <div className="summary-hero" role="list" aria-label={t.inventorySummary}>
      <p className="summary-hero-count">{totalProducts} {totalProducts === 1 ? t.product : t.products}</p>

      <div className="summary-hero-cards">
        {/* Stock Value — teal gradient */}
        <button
          className="summary-hero-card summary-hero-card--teal"
          role="listitem"
          onClick={onStockClick}
          aria-label={`${t.stockValue}: ${formatProductPrice(totalStockValue)}`}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">{formatProductPrice(totalStockValue)}</span>
            <span className="summary-hero-label">
              {t.stockValue}
              <TrendingUp size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron" />
        </button>

        {/* Low Stock Alert — amber/warning or lime/safe */}
        <button
          className={`summary-hero-card ${lowStockCount > 0 ? 'summary-hero-card--amber' : 'summary-hero-card--safe'}`}
          role="listitem"
          onClick={onLowStockClick}
          aria-label={lowStockCount > 0 ? `${lowStockCount} ${t.lowOnStock}` : t.allStocked}
        >
          <div className="summary-hero-card-content">
            <span className="summary-hero-amount">{lowStockCount}</span>
            <span className="summary-hero-label">
              {lowStockCount > 0 ? t.lowOnStock : t.allStocked}
              <AlertTriangle size={14} aria-hidden="true" />
            </span>
          </div>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron summary-hero-chevron--dark" />
        </button>
      </div>
    </div>
  )
}
