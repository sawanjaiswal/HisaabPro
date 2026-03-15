/** Product list row item — txn-row pattern */

import React from 'react'
import type { ProductSummary } from '../product.types'
import { getProductInitials, getProductAvatarColor, formatProductPrice, formatStock, getStockStatus } from '../product.utils'

interface ProductCardProps {
  product: ProductSummary
  onClick: (id: string) => void
}

const STOCK_BADGE_CLASSES: Record<string, string> = {
  ok:  'badge badge-paid',
  low: 'badge badge-pending',
  out: 'badge badge-overdue',
}

const STOCK_BADGE_LABELS: Record<string, string> = {
  ok:  'In Stock',
  low: 'Low Stock',
  out: 'Out of Stock',
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const status = getStockStatus(product.currentStock, product.minStockLevel)
  const badgeClass = STOCK_BADGE_CLASSES[status]
  const badgeLabel = STOCK_BADGE_LABELS[status]

  return (
    <div
      className="txn-row"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${product.name}`}
      onClick={() => onClick(product.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(product.id) }}
      style={{ minHeight: '44px', cursor: 'pointer' }}
    >
      <div
        className="txn-avatar avatar"
        style={{ backgroundColor: getProductAvatarColor(product.name) }}
        aria-hidden="true"
      >
        {getProductInitials(product.name)}
      </div>

      <div className="txn-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="txn-name">{product.name}</span>
          <span className={badgeClass} aria-label={`Stock status: ${badgeLabel}`}>{badgeLabel}</span>
        </div>
        <span className="txn-date">{product.sku} · {product.category.name}</span>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="txn-amount">{formatProductPrice(product.salePrice)}</div>
        <div className="txn-category">
          {formatStock(product.currentStock, product.unit.symbol)}
        </div>
      </div>
    </div>
  )
}
