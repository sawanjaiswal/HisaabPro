/** POS — Cart line item with qty stepper + remove */

import { Minus, Plus, Trash2 } from 'lucide-react'
import { paiseToInr } from '../../utils/pos.format'
import { useLanguage } from '@/hooks/useLanguage'
import type { PosCartItem } from '../../types/pos.types'

interface CartLineItemProps {
  item:           PosCartItem
  onUpdateQty:    (productId: string, qty: number) => void
  onRemove:       (productId: string) => void
}

export function CartLineItem({ item, onUpdateQty, onRemove }: CartLineItemProps) {
  const { t } = useLanguage()
  const total = item.quantity * item.unitPrice - item.discount

  return (
    <li className="pos-cart-item">
      <div className="pos-cart-item__main">
        <div className="pos-cart-item__info">
          <p className="pos-cart-item__name">{item.name}</p>
          <p className="pos-cart-item__unit-price">
            {paiseToInr(item.unitPrice)} / {item.unit}
          </p>
          {item.discount > 0 && (
            <p className="pos-cart-item__discount">
              {t.posDiscount ?? 'Disc'}: -{paiseToInr(item.discount)}
            </p>
          )}
        </div>

        <div className="pos-cart-item__right">
          <p className="pos-cart-item__total">{paiseToInr(total)}</p>
          <div className="pos-cart-item__stepper" role="group" aria-label={`Quantity for ${item.name}`}>
            <button
              type="button"
              className="pos-stepper-btn"
              onClick={() =>
                item.quantity === 1
                  ? onRemove(item.productId)
                  : onUpdateQty(item.productId, item.quantity - 1)
              }
              aria-label={item.quantity === 1 ? (t.posRemoveItem ?? 'Remove') : (t.posDecreaseQty ?? 'Decrease')}
            >
              {item.quantity === 1 ? (
                <Trash2 size={13} aria-hidden="true" />
              ) : (
                <Minus size={13} aria-hidden="true" />
              )}
            </button>

            <span className="pos-stepper-qty" aria-live="polite">
              {item.quantity}
            </span>

            <button
              type="button"
              className="pos-stepper-btn"
              onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
              disabled={item.quantity >= item.stock}
              aria-label={t.posIncreaseQty ?? 'Increase quantity'}
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
