/** Product Detail — Hero header card with identity + stock level */

import React from 'react'
import type { ProductDetail } from '../product.types'
import {
  formatProductPrice,
  formatStock,
  getStockStatus,
  getStockColor,
} from '../product.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'

interface ProductDetailHeaderProps {
  product: ProductDetail
}

const STOCK_STATUS_LABELS = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' } as const
const STOCK_BADGE_CLASSES = { ok: 'badge badge-paid', low: 'badge badge-pending', out: 'badge badge-overdue' } as const

export const ProductDetailHeader: React.FC<ProductDetailHeaderProps> = ({ product }) => {
  const stockStatus = getStockStatus(product.currentStock, product.minStockLevel)
  const stockColor = getStockColor(stockStatus)

  return (
    <div className="card-primary party-detail-header" role="region" aria-label="Product overview">
      <PartyAvatar name={product.name} size="lg" className="party-detail-avatar" />

      <div className="party-detail-info">
        <h2 className="party-detail-name">{product.name}</h2>
        <div className="party-detail-meta">
          <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>{product.sku}</span>
          <span
            className={STOCK_BADGE_CLASSES[stockStatus]}
            aria-label={`Stock status: ${STOCK_STATUS_LABELS[stockStatus]}`}
          >
            {STOCK_STATUS_LABELS[stockStatus]}
          </span>
        </div>
      </div>

      <div className="party-detail-balance" aria-label={`Stock: ${formatStock(product.currentStock, product.unit.symbol)}`}>
        <span className="money-hero" style={{ color: stockColor }}>
          {formatStock(product.currentStock, product.unit.symbol)}
        </span>
        <span className="money-label" style={{ opacity: 0.7 }}>In Stock</span>
        <span className="money-label" style={{ opacity: 0.55, marginTop: 'var(--space-1)' }}>
          Sale: {formatProductPrice(product.salePrice)}
        </span>
      </div>
    </div>
  )
}
