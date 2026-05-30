/** POS — Cart slide-in panel */

import { X, ShoppingCart } from 'lucide-react'
import { CartLineItem } from './CartLineItem'
import { CartTotals } from './CartTotals'
import { CartEmpty } from './CartEmpty'
import { useLanguage } from '@/hooks/useLanguage'
import type { PosCartItem, PosCartTotals } from '../../types/pos.types'
import { Button } from '@/components/ui/Button'

interface CartPanelProps {
  items:         PosCartItem[]
  totals:        PosCartTotals
  onUpdateQty:   (productId: string, qty: number) => void
  onRemove:      (productId: string) => void
  onCheckout:    () => void
  onClose:       () => void
}

export function CartPanel({
  items,
  totals,
  onUpdateQty,
  onRemove,
  onCheckout,
  onClose,
}: CartPanelProps) {
  const { t } = useLanguage()
  const isEmpty = items.length === 0

  return (
    <div className="pos-cart-panel" role="complementary" aria-label={t.posCart ?? 'Cart'}>
      {/* Header */}
      <div className="pos-cart-panel__header">
        <div className="pos-cart-panel__title-row">
          <ShoppingCart size={18} aria-hidden="true" />
          <h2 className="pos-cart-panel__title">
            {t.posCart ?? 'Cart'}
            {items.length > 0 && (
              <span className="pos-cart-panel__count" aria-label={`${items.length} items`}>
                {items.length}
              </span>
            )}
          </h2>
        </div>
        <Button variant="none"
          type="button"
          className="pos-cart-panel__close"
          onClick={onClose}
          aria-label={t.close ?? 'Close cart'}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>

      {/* Body */}
      <div className="pos-cart-panel__body">
        {isEmpty ? (
          <CartEmpty />
        ) : (
          <ul className="pos-cart-list" aria-label={t.posCartItems ?? 'Cart items'}>
            {items.map((item) => (
              <CartLineItem
                key={item.productId}
                item={item}
                onUpdateQty={onUpdateQty}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="pos-cart-panel__footer">
          <CartTotals totals={totals} />
          <Button variant="none"
            type="button"
            className="pos-cart-panel__checkout-btn"
            onClick={onCheckout}
            aria-label={`${t.posCheckout ?? 'Checkout'} — ${t.posGrandTotal ?? ''}`}
          >
            {t.posCheckout ?? 'Checkout'}
          </Button>
        </div>
      )}
    </div>
  )
}
