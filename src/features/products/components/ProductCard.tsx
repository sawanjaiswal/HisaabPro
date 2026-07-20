/** Product list row — GPT mockup layout.
 *
 * Thumbnail · name / "SKU • Category" / status badge  ·  right: price + kebab,
 * qty, margin. Long-press enters bulk-select; the kebab menu holds
 * View / Edit / Delete. Amounts in paise; margin computed from sale/purchase.
 */

import React, { useRef, useCallback } from 'react'
import { Check, MoreHorizontal } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductSummary } from '../product.types'
import {
  formatProductPrice,
  formatStockQtyUnit,
  formatMarginPercent,
  getStockStatus,
} from '../product.utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'

interface ProductCardProps {
  product: ProductSummary
  onClick: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onLongPress?: (id: string) => void
  isSelected?: boolean
  isBulkMode?: boolean
}

const STOCK_BADGE_VARIANT = {
  ok: 'paid',
  low: 'pending',
  out: 'overdue',
} as const

const LONG_PRESS_MS = 500

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  onEdit,
  onDelete,
  onLongPress,
  isSelected = false,
  isBulkMode = false,
}) => {
  const { t } = useLanguage()
  const status = getStockStatus(product.currentStock, product.minStockLevel)
  const badgeLabel = { ok: t.inStock, low: t.lowStock, out: t.outOfStock }[status]
  const marginLabel = formatMarginPercent(product.salePrice, product.purchasePrice)
  const unitLabel =
    product.unit.name.charAt(0).toUpperCase() + product.unit.name.slice(1)

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

  // Stop kebab interactions from bubbling into the row (navigation / long-press).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      className={`product-row${isSelected ? ' product-row--selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${isBulkMode ? (isSelected ? t.deselectProduct : t.selectProduct) : t.viewDetailsFor} ${product.name}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {isBulkMode ? (
        <div
          className={`bulk-check${isSelected ? ' bulk-check--active' : ''}`}
          aria-hidden="true"
        >
          {isSelected && <Check size={16} />}
        </div>
      ) : product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-row-thumb"
          aria-hidden="true"
        />
      ) : (
        <PartyAvatar name={product.name} size="sm" className="product-row-thumb" />
      )}

      <div className="product-row-main">
        <span className="product-row-name">{product.name}</span>
        <span className="product-row-meta">
          {t.skuLabel}: {product.sku} · {product.category?.name ?? t.uncategorized}
        </span>
        <Badge variant={STOCK_BADGE_VARIANT[status]} className="product-row-badge">
          {badgeLabel}
        </Badge>
      </div>

      <div className="product-row-right">
        <div className="product-row-figures">
          <span className="product-row-price">{formatProductPrice(product.salePrice)}</span>
          <span className="product-row-qty">
            {formatStockQtyUnit(product.currentStock, unitLabel)}
          </span>
          {marginLabel && (
            <span className="product-row-margin">{t.marginLabel} {marginLabel}</span>
          )}
        </div>
        {!isBulkMode && (
          <span
            className="product-row-kebab-wrap"
            onClick={stop}
            onPointerDown={stop}
            onKeyDown={stop}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="none"
                  className="product-row-kebab"
                  aria-label={`${t.product}: ${product.name}`}
                >
                  <MoreHorizontal size={18} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => onClick(product.id)}>{t.view}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(product.id)}>{t.edit}</DropdownMenuItem>
                <DropdownMenuItem danger onSelect={() => onDelete(product.id, product.name)}>
                  {t.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>
    </div>
  )
}
