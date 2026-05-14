/** Create Invoice — single editable line item row (orchestrator shell)
 *
 * #132 Batch 6: accepts priceMode + tier props; delegates resolver logic
 * to useLineItemResolver. Shows PriceSourceHint below the rate field.
 */

import React, { useCallback } from 'react'
import { Trash2, Gift } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { LineItemFormData } from '../invoice.types'
import { formatInvoiceAmount } from '../invoice-format.utils'
import { calculateLineTotal } from '../invoice-calc.utils'
import { LineItemBatchPicker } from './LineItemBatchPicker'
import { LineItemFields } from './LineItemFields'
import { useLineItemResolver } from './useLineItemResolver'
import type { PriceListDetail } from '@/features/price-lists/price-list.types'
import type { PriceMode } from './useLinePriceMeta'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItemEditorProps {
  item: LineItemFormData & {
    productName: string
    discountAmount: number
    lineTotal: number
    profit: number
    profitPercent: number
  }
  index: number
  onUpdate: (index: number, updates: Partial<LineItemFormData>) => void
  onRemove: (index: number) => void
  showProfit: boolean
  expiredBatchPolicy?: 'HARD_BLOCK' | 'WARN_ONLY'
  canMarkFree?: boolean

  // ─── #132 Batch 6 — price resolution ───────────────────────────────────
  priceTier?: PriceListDetail | null
  partyPricing?: Record<string, { price: number; minQty: number }> | null
  productSalePrice?: number
  priceMode: PriceMode
  onPriceModeChange: (index: number, mode: PriceMode) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LineItemEditor: React.FC<LineItemEditorProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  showProfit,
  expiredBatchPolicy = 'WARN_ONLY',
  canMarkFree = false,
  priceTier = null,
  partyPricing = null,
  productSalePrice,
  priceMode,
  onPriceModeChange,
}) => {
  const { t } = useLanguage()
  const isFree = item.isFreeItem === true

  // ─── Resolver hook ────────────────────────────────────────────────────────

  const { latestResolved, resolveNow } = useLineItemResolver({
    productId: item.productId,
    quantity: item.quantity,
    currentRate: item.rate,
    isFree,
    priceMode,
    priceTier,
    partyPricing: partyPricing ?? null,
    productSalePrice,
    onUpdate: (rate) => onUpdate(index, { rate }),
  })

  const priceSource = priceMode === 'EDITED' ? ('MANUAL' as const) : latestResolved.source

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleFieldsChange = useCallback(
    (updates: Partial<LineItemFormData>) => {
      if ('rate' in updates && updates.rate !== item.rate) {
        onPriceModeChange(index, 'EDITED')
      }
      onUpdate(index, updates)
    },
    [index, item.rate, onUpdate, onPriceModeChange],
  )

  const handleBatchSelect = useCallback(
    (batchId: string) => onUpdate(index, { batchId }),
    [index, onUpdate],
  )

  const toggleFree = useCallback(() => {
    onUpdate(index, { isFreeItem: !isFree })
  }, [index, isFree, onUpdate])

  const handleResetPrice = useCallback(() => {
    onPriceModeChange(index, 'AUTO')
    const resolved = resolveNow(item.quantity)
    if (resolved) onUpdate(index, { rate: resolved.resolvedPaise })
  }, [index, item.quantity, onPriceModeChange, resolveNow, onUpdate])

  // ─── Totals ────────────────────────────────────────────────────────────────

  const { lineTotal: recalcLineTotal } = calculateLineTotal(
    item.quantity,
    item.rate,
    item.discountType,
    item.discountValue,
  )
  const displayLineTotal = isFree ? 0 : recalcLineTotal
  const isProfit = item.profit >= 0
  const profitClass = isProfit ? 'line-item-profit line-item-profit-positive' : 'line-item-profit line-item-profit-negative'

  return (
    <div
      className={`line-item-row${isFree ? ' line-item-row--free' : ''}`}
      aria-label={`Line item ${index + 1}: ${item.productName}`}
    >
      <div className="line-item-header">
        <span className="line-item-product-name">
          {item.productName}
          {isFree && (
            <span
              className="badge"
              style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 999, background: 'var(--color-success-50)', color: 'var(--color-success-700)', fontSize: 11, fontWeight: 700 }}
            >
              {t.freeItemBadge}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {canMarkFree && (
            <button
              type="button"
              className={`btn btn-ghost btn-sm${isFree ? ' active' : ''}`}
              onClick={toggleFree}
              aria-pressed={isFree}
              aria-label={isFree ? t.unmarkFreeItem : t.markFreeItem}
              title={isFree ? t.unmarkFreeItem : t.markFreeItem}
            >
              <Gift size={16} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="line-item-remove"
            onClick={() => onRemove(index)}
            aria-label={`${item.productName} ${t.removeFromLineItems}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {item.batchTracking && (
        <LineItemBatchPicker
          productId={item.productId}
          batchId={item.batchId}
          expiredBatchPolicy={expiredBatchPolicy}
          onSelect={handleBatchSelect}
        />
      )}

      <LineItemFields
        index={index}
        productName={item.productName}
        quantity={item.quantity}
        rate={item.rate}
        discountType={item.discountType}
        discountValue={item.discountValue}
        readOnly={isFree}
        onChange={handleFieldsChange}
        priceSource={priceSource}
        priceListName={priceTier?.name}
        priceListId={priceTier?.id}
        onResetPrice={handleResetPrice}
      />

      <div className="line-item-total">
        <span className="line-item-total-label">{t.lineTotal}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {showProfit && !isFree && (
            <span className={profitClass}>
              {isProfit ? '+' : ''}{item.profitPercent.toFixed(1)}%
            </span>
          )}
          <span className="line-item-total-amount">{formatInvoiceAmount(displayLineTotal)}</span>
        </div>
      </div>
    </div>
  )
}

// Re-export PriceMode so callers don't need to import from useLinePriceMeta
export type { PriceMode }
