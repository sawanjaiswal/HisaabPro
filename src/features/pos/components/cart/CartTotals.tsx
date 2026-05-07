/** POS — Cart totals breakdown */

import { paiseToInr } from '../../utils/pos.format'
import { useLanguage } from '@/hooks/useLanguage'
import type { PosCartTotals } from '../../types/pos.types'

interface CartTotalsProps {
  totals: PosCartTotals
}

export function CartTotals({ totals }: CartTotalsProps) {
  const { t } = useLanguage()

  return (
    <div className="pos-cart-totals" aria-label="Cart totals">
      <div className="pos-totals-row">
        <span>{t.posSubtotal ?? 'Subtotal'}</span>
        <span>{paiseToInr(totals.subtotal)}</span>
      </div>

      {totals.totalDiscount > 0 && (
        <div className="pos-totals-row pos-totals-row--discount">
          <span>{t.posDiscount ?? 'Discount'}</span>
          <span>-{paiseToInr(totals.totalDiscount)}</span>
        </div>
      )}

      {totals.totalTax > 0 && (
        <div className="pos-totals-row">
          <span>{t.posTax ?? 'Tax'}</span>
          <span>{paiseToInr(totals.totalTax)}</span>
        </div>
      )}

      <div className="pos-totals-row pos-totals-row--grand">
        <span>{t.posGrandTotal ?? 'Total'}</span>
        <span>{paiseToInr(totals.grandTotal)}</span>
      </div>
    </div>
  )
}
