/** Stock adjustment row (mockup #48) — product, reason, date, signed delta.
 *
 * The mockup labels each row with an "ADJ-…" code. Movements carry no such
 * number, so rather than invent one the row leads with the product and shows
 * the reason underneath — which is what a user is actually scanning for.
 */

import React from 'react'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/format'
import { adjustmentReasonLabel } from '../adjustments.utils'
import type { StockAdjustment } from '../adjustments.types'

interface AdjustmentRowProps {
  adjustment: StockAdjustment
  onOpen: (productId: string) => void
}

export const AdjustmentRow: React.FC<AdjustmentRowProps> = ({ adjustment, onOpen }) => {
  const { t } = useLanguage()
  const { product, quantity } = adjustment
  const isIn = quantity > 0
  const delta = `${isIn ? '+' : '−'}${Math.abs(quantity)} ${product.unit.symbol}`

  return (
    <div className="adjustment-row" role="listitem">
      <Button
        type="button"
        variant="ghost"
        className="adjustment-row-main"
        onClick={() => onOpen(product.id)}
        aria-label={`${product.name} — ${delta}`}
      >
        <span className="adjustment-row-icon" aria-hidden="true">
          <Package size={20} />
        </span>

        <span className="adjustment-row-text">
          <span className="adjustment-row-name">{product.name}</span>
          <span className="adjustment-row-meta">
            {adjustmentReasonLabel(adjustment, t)} · {formatDate(adjustment.movementDate)}
          </span>
        </span>

        <span
          className={`adjustment-row-delta tabular-nums adjustment-row-delta--${isIn ? 'in' : 'out'}`}
        >
          {delta}
        </span>
      </Button>
    </div>
  )
}
