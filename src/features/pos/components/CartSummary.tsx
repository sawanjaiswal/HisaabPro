/** POS Cart Summary — Sticky bottom bar with total + checkout CTA */

import { ShoppingCart } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { cartSubtotal, cartItemCount } from '../pos.utils'

import type { PosCartItem } from '../pos.types'

interface CartSummaryProps {
  items: PosCartItem[]
  onCheckout: () => void
}

export function CartSummary({ items, onCheckout }: CartSummaryProps) {
  const total = cartSubtotal(items)
  const count = cartItemCount(items)

  if (items.length === 0) return null

  return (
    <div className="pos-cart-summary" aria-label="Cart summary">
      <div className="pos-cart-summary-info">
        <ShoppingCart size={18} aria-hidden="true" />
        <span className="pos-cart-summary-count">
          {count} item{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="pos-cart-summary-right">
        <span className="pos-cart-summary-total">{formatPaise(total)}</span>
        <button
          type="button"
          className="btn btn-primary pos-charge-btn"
          onClick={onCheckout}
          aria-label={`Charge ${formatPaise(total)}`}
        >
          Charge {formatPaise(total)}
        </button>
      </div>
    </div>
  )
}
