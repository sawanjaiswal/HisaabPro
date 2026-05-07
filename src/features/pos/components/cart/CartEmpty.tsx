/** POS — Cart empty state */

import { ShoppingCart } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export function CartEmpty() {
  const { t } = useLanguage()
  return (
    <div className="pos-cart-empty">
      <ShoppingCart
        size={48}
        className="pos-cart-empty__icon"
        aria-hidden="true"
        strokeWidth={1.25}
      />
      <p className="pos-cart-empty__title">{t.posCartEmptyTitle ?? 'Cart is empty'}</p>
      <p className="pos-cart-empty__body">
        {t.posCartEmptyBody ?? 'Tap a product to add it to the cart'}
      </p>
    </div>
  )
}
