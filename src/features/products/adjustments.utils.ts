/** Stock Adjustments (mockup #48) — row label helpers. */

import { STOCK_ADJUST_REASON_LABELS } from './product.constants'
import type { StockAdjustReason } from './product.types'
import type { StockAdjustment } from './adjustments.types'

type Labels = { stockIn: string; stockOut: string }

/**
 * What to show under the product name. A free-typed "OTHER" reason is the most
 * specific thing anyone recorded, so it wins; a known reason resolves to its
 * label; nothing recorded falls back to the direction.
 */
export function adjustmentReasonLabel(adjustment: StockAdjustment, t: Labels): string {
  const custom = adjustment.customReason?.trim()
  if (custom) return custom

  const reason = adjustment.reason as StockAdjustReason | null
  if (reason && reason in STOCK_ADJUST_REASON_LABELS) {
    return STOCK_ADJUST_REASON_LABELS[reason]
  }

  return adjustment.quantity > 0 ? t.stockIn : t.stockOut
}
