/** Product list row item — txn-row pattern with bulk select */

import React, { useRef, useCallback } from 'react'
import { Check } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductSummary } from '../product.types'
import { formatProductPrice, formatStock, getStockStatus } from '../product.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'

interface ProductCardProps {
  product: ProductSummary
  onClick: (id: string) => void
  onLongPress?: (id: string) => void
  isSelected?: boolean
  isBulkMode?: boolean
}

const STOCK_BADGE_CLASSES: Record<string, string> = {
  ok:  'badge badge-paid',
  low: 'badge badge-pending',
  out: 'badge badge-overdue',
}

const LONG_PRESS_MS = 500

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  onLongPress,
  isSelected = false,
  isBulkMode = false,
}) => {
  const { t } = useLanguage()
  const STOCK_BADGE_LABELS: Record<string, string> = {
    ok:  t.inStock,
    low: t.lowStock,
    out: t.outOfStock,
  }
  const status = getStockStatus(product.currentStock, product.minStockLevel)
  const badgeClass = STOCK_BADGE_CLASSES[status]
  const badgeLabel = STOCK_BADGE_LABELS[status]

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress(product.id)
    }, LONG_PRESS_MS)
  }, [onLongPress, product.id])

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    onClick(product.id)
  }, [onClick, product.id])

  return (
    <div
      className={`txn-row${isSelected ? ' txn-row--selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${isBulkMode ? (isSelected ? t.deselectProduct : t.selectProduct) : t.viewDetailsFor} ${product.name}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: 'pointer' }}
    >
      {isBulkMode ? (
        <div
          className={`bulk-check${isSelected ? ' bulk-check--active' : ''}`}
          aria-hidden="true"
        >
          {isSelected && <Check size={16} />}
        </div>
      ) : (
        <PartyAvatar name={product.name} size="sm" className="txn-avatar" />
      )}

      <div className="txn-info">
        <div className="product-card-header">
          <span className="txn-name">{product.name}</span>
          <span className={badgeClass} aria-label={`${t.stockStatusPrefix}: ${badgeLabel}`}>{badgeLabel}</span>
        </div>
        <span className="txn-date">{product.sku} · {product.category.name}</span>
      </div>

      <div className="product-card-right">
        <div className="txn-amount">{formatProductPrice(product.salePrice)}</div>
        <div className="txn-category">
          {formatStock(product.currentStock, product.unit.symbol)}
        </div>
      </div>
    </div>
  )
}
