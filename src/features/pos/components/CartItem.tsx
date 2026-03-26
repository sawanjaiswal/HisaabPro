/** POS Cart Item — Single row with qty stepper + remove */

import { Minus, Plus, Trash2 } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import { lineTotal } from '../pos.utils'

import type { PosCartItem } from '../pos.types'

interface CartItemProps {
  item: PosCartItem
  onUpdateQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
}

export function CartItem({ item, onUpdateQty, onRemove }: CartItemProps) {
  const { t } = useLanguage()
  const total = lineTotal(item)
  const atMin = item.quantity <= 1
  const atMax = item.quantity >= item.stock

  return (
    <div className="pos-cart-item" role="listitem">
      <div className="pos-cart-item-info">
        <span className="pos-cart-item-name">{item.name}</span>
        <span className="pos-cart-item-price">
          {formatPaise(item.unitPrice)} {t.posEach}
        </span>
      </div>
      <div className="pos-cart-item-actions">
        <div className="pos-qty-stepper" role="group" aria-label={`${t.qty} — ${item.name}`}>
          <button
            type="button"
            className="pos-qty-btn"
            onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
            disabled={atMin}
            aria-label={t.posDecreaseQty}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="pos-qty-value" aria-live="polite">{item.quantity}</span>
          <button
            type="button"
            className="pos-qty-btn"
            onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
            disabled={atMax}
            aria-label={t.posIncreaseQty}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        <span className="pos-cart-item-total">{formatPaise(total)}</span>
        <button
          type="button"
          className="pos-cart-item-remove"
          onClick={() => onRemove(item.productId)}
          aria-label={`${t.remove} ${item.name}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
