/** POS — Cart bottom sheet.
 *
 * Built on <Drawer>: backdrop, portal, focus trap, Escape and drag-to-dismiss
 * come from the primitive (PLATFORM_SHELL C6), which also owns the fixed
 * positioning and safe-area padding this panel used to hand-roll.
 */

import { ShoppingCart } from 'lucide-react'
import { CartLineItem } from './CartLineItem'
import { CartTotals } from './CartTotals'
import { CartEmpty } from './CartEmpty'
import { useLanguage } from '@/hooks/useLanguage'
import type { PosCartItem, PosCartTotals } from '../../types/pos.types'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'

interface CartPanelProps {
  open:          boolean
  items:         PosCartItem[]
  totals:        PosCartTotals
  onUpdateQty:   (productId: string, qty: number) => void
  onRemove:      (productId: string) => void
  onCheckout:    () => void
  onClose:       () => void
}

export function CartPanel({
  open,
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
    <Drawer
      open={open}
      onClose={onClose}
      title={t.posCart ?? 'Cart'}
      size="md"
      footer={isEmpty ? undefined : (
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
    >
      <div className="pos-cart-panel__title-row">
        <ShoppingCart size={18} aria-hidden="true" />
        {items.length > 0 && (
          <span className="pos-cart-panel__count" aria-label={`${items.length} items`}>
            {items.length}
          </span>
        )}
      </div>

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
    </Drawer>
  )
}
