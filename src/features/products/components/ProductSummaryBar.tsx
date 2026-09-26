/** Products — Hero card pair (Stock Value / Low Stock)
 *
 * Matches Parties (PartySummaryBar) pattern:
 * Emerald card (Total Stock Value) + Lime card (Low Stock / Need Reorder).
 * Uses shared summary-hero CSS tokens. All amounts in PAISE.
 */

import React from 'react'
import { ChevronRight, Layers, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { formatRupees } from '@/lib/format'
import type { ProductListResponse } from '../product.types'

interface ProductSummaryBarProps {
  summary: ProductListResponse['summary']
  onStockValueClick?: () => void
  onLowStockClick?: () => void
}

export const ProductSummaryBar: React.FC<ProductSummaryBarProps> = ({
  summary,
  onStockValueClick,
  onLowStockClick,
}) => {
  const { t } = useLanguage()
  const { totalProducts, lowStockCount, totalStockValue, outOfStockCount } = summary

  return (
    <div className="summary-hero" role="list" aria-label={t.inventorySummary}>
      <div className="summary-hero-cards">
        {/* Total Stock Value — emerald gradient */}
        <Button
          variant="none"
          className="summary-hero-card summary-hero-card--teal summary-hero-card--v2"
          role="listitem"
          onClick={onStockValueClick}
          aria-label={`${t.inventoryValue}: ${formatRupees(totalStockValue)}`}
        >
          <span className="summary-hero-icon-ring" aria-hidden="true">
            <Layers size={22} />
          </span>
          <span className="summary-hero-card-content">
            <span className="summary-hero-label">{t.inventoryValue}</span>
            <span className="summary-hero-amount">
              {formatRupees(totalStockValue)}
            </span>
            <span className="summary-hero-sub">
              {totalProducts} {totalProducts === 1 ? t.item : t.items}
            </span>
          </span>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron" />
        </Button>

        {/* Low Stock — lime */}
        <Button
          variant="none"
          className="summary-hero-card summary-hero-card--lime summary-hero-card--v2"
          role="listitem"
          onClick={onLowStockClick}
          aria-label={`${t.lowStock}: ${lowStockCount}`}
        >
          <span className="summary-hero-icon-ring summary-hero-icon-ring--dark" aria-hidden="true">
            <AlertTriangle size={22} />
          </span>
          <span className="summary-hero-card-content">
            <span className="summary-hero-label">{t.lowStock}</span>
            <span className="summary-hero-amount">
              {lowStockCount}
            </span>
            <span className="summary-hero-sub">
              {outOfStockCount > 0
                ? `${outOfStockCount} ${t.outOfStock ?? 'Out of stock'}`
                : (t.needReorder ?? 'Need reorder')}
            </span>
          </span>
          <ChevronRight size={20} aria-hidden="true" className="summary-hero-chevron summary-hero-chevron--dark" />
        </Button>
      </div>
    </div>
  )
}
