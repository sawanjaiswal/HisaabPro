/** Product Detail — Hero header card with identity + stock level */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
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

const STOCK_BADGE_CLASSES = { ok: 'badge badge-paid', low: 'badge badge-pending', out: 'badge badge-overdue' } as const

export const ProductDetailHeader: React.FC<ProductDetailHeaderProps> = ({ product }) => {
  const { t } = useLanguage()
  const STOCK_STATUS_LABELS: Record<string, string> = { ok: t.inStock, low: t.lowStock, out: t.outOfStock }
  const stockStatus = getStockStatus(product.currentStock, product.minStockLevel)
  const stockColor = getStockColor(stockStatus)

  return (
    <div className="card-primary party-detail-header" role="region" aria-label={t.productOverview}>
      <PartyAvatar name={product.name} size="lg" className="party-detail-avatar" />

      <div className="party-detail-info">
        <h2 className="party-detail-name">{product.name}</h2>
        <div className="party-detail-meta">
          <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>{product.sku}</span>
          <span
            className={STOCK_BADGE_CLASSES[stockStatus]}
            aria-label={`${t.stockStatusPrefix}: ${STOCK_STATUS_LABELS[stockStatus]}`}
          >
            {STOCK_STATUS_LABELS[stockStatus]}
          </span>
        </div>
      </div>

      <div className="party-detail-balance" aria-label={`${t.stockLabel}: ${formatStock(product.currentStock, product.unit.symbol)}`}>
        <span className="money-hero" style={{ color: stockColor }}>
          {formatStock(product.currentStock, product.unit.symbol)}
        </span>
        <span className="money-label" style={{ opacity: 0.7 }}>{t.inStockLabel}</span>
        <span className="money-label" style={{ opacity: 0.55, marginTop: 'var(--space-1)' }}>
          {t.salePrefix}: {formatProductPrice(product.salePrice)}
        </span>
      </div>
    </div>
  )
}
