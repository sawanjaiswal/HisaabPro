/** LineItemEditor — single editable line item card matching modern fintech design (SSOT) */
import React, { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { LineItemFormData } from '../invoice.types'
import { paiseToRupees, rupeesToPaise } from '../invoice-format.utils'
import { calculateLineTotal } from '../invoice-calc.utils'
import { LineItemBatchPicker } from './LineItemBatchPicker'
import { LineItemExpandedFields } from './LineItemExpandedFields'
import { LineItemDiscountRow } from './LineItemDiscountRow'
import { LineItemActionIcons } from './LineItemActionIcons'
import { LineItemCardHeader } from './LineItemCardHeader'
import { useLineItemResolver } from './useLineItemResolver'
import { useLineItemProductInfo } from './useLineItemProductInfo'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Button } from '@/components/ui/Button'
import type { PriceListDetail } from '@/features/price-lists/price-list.types'
import type { PriceMode } from './useLinePriceMeta'

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
  onEditProduct?: (productId: string) => void
  showProfit: boolean
  expiredBatchPolicy?: 'HARD_BLOCK' | 'WARN_ONLY'
  canMarkFree?: boolean
  forceCollapsed?: boolean

  // price resolution
  priceTier?: PriceListDetail | null
  partyPricing?: Record<string, { price: number; minQty: number }> | null
  productSalePrice?: number
  priceMode: PriceMode
  onPriceModeChange: (index: number, mode: PriceMode) => void
}

export const LineItemEditor: React.FC<LineItemEditorProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  onEditProduct,
  showProfit,
  expiredBatchPolicy = 'WARN_ONLY',
  canMarkFree = false,
  forceCollapsed = false,
  priceTier = null,
  partyPricing = null,
  productSalePrice,
  priceMode,
  onPriceModeChange,
}) => {
  const { t } = useLanguage()
  const isFree = item.isFreeItem === true
  const productMeta = useLineItemProductInfo(item.productId)

  const hasActiveDiscount = (item.discountValue ?? 0) > 0
  const [showDiscount, setShowDiscount] = useState(() => hasActiveDiscount)
  const [rateExpanded, setRateExpanded] = useState(false)

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

  const handleRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      onPriceModeChange(index, 'EDITED')
      if (raw === '') {
        onUpdate(index, { rate: 0 })
        return
      }
      const rupees = parseFloat(raw)
      if (!isNaN(rupees) && rupees >= 0) {
        onUpdate(index, { rate: rupeesToPaise(rupees) })
      }
    },
    [index, onPriceModeChange, onUpdate],
  )

  const handleResetPrice = useCallback(() => {
    onPriceModeChange(index, 'AUTO')
    const resolved = resolveNow(item.quantity)
    if (resolved) onUpdate(index, { rate: resolved.resolvedPaise })
  }, [index, item.quantity, onPriceModeChange, resolveNow, onUpdate])

  const { lineTotal: recalcLineTotal, discountAmount } = calculateLineTotal(
    item.quantity,
    item.rate,
    item.discountType,
    item.discountValue,
  )
  const displayLineTotal = isFree ? 0 : recalcLineTotal

  return (
    <div
      className={`line-item-card ${isFree ? 'line-item-card--free' : ''} ${hasActiveDiscount ? 'line-item-card--active-discount' : ''}`}
      aria-label={`Line item ${index + 1}: ${item.productName}`}
    >
      {/* Top section: Avatar + Title & Stock on left, Subtotal on right */}
      <LineItemCardHeader
        productName={item.productName}
        sku={productMeta.sku}
        unitSymbol={productMeta.unitSymbol}
        currentStock={productMeta.currentStock}
        isFree={isFree}
        freeItemBadge={t.freeItemBadge}
        displayLineTotal={displayLineTotal}
        hasActiveDiscount={hasActiveDiscount}
      />

      {/* Controls row: Rate pill on left, Action Icons + Stepper on right */}
      <div className="line-item-card__controls">
        {/* Left: Rate Pill with expand chevron */}
        <Button
          variant="none"
          type="button"
          onClick={() => setRateExpanded((v) => !v)}
          className="line-item-card__rate-btn"
          aria-expanded={rateExpanded}
          aria-label={`${rateExpanded ? 'Hide' : 'Change'} rate for ${item.productName}`}
        >
          <span>₹ {paiseToRupees(item.rate)}/{productMeta.unitSymbol}</span>
          {rateExpanded ? (
            <ChevronUp size={13} className="text-muted" />
          ) : (
            <ChevronDown size={13} className="text-muted" />
          )}
        </Button>

        {/* Right: Action icons and Quantity Stepper */}
        <div className="flex items-center gap-2 ml-auto">
          <LineItemActionIcons
            index={index}
            productName={item.productName}
            productId={item.productId}
            isFree={isFree}
            canMarkFree={canMarkFree}
            hasActiveDiscount={hasActiveDiscount}
            showDiscount={showDiscount}
            onToggleDiscount={() => {
              setShowDiscount((prev) => !prev)
            }}
            onToggleFree={() => onUpdate(index, { isFreeItem: !isFree })}
            onEditProduct={onEditProduct}
            onRemove={onRemove}
          />

          <QuantityStepper
            value={item.quantity}
            onChange={(qty) => onUpdate(index, { quantity: qty })}
            min={0}
            step={1}
            disabled={isFree}
            size="md"
            ariaLabel={`Quantity for ${item.productName}`}
          />
        </div>
      </div>

      {/* Batch selector if enabled */}
      {item.batchTracking && (
        <div className="line-item-card__batch-row">
          <LineItemBatchPicker
            productId={item.productId}
            batchId={item.batchId}
            expiredBatchPolicy={expiredBatchPolicy}
            onSelect={(batchId: string) => onUpdate(index, { batchId })}
          />
        </div>
      )}

      {/* Dedicated Discount Row (toggleable by Tag icon, closes cleanly) */}
      {!forceCollapsed && showDiscount && (
        <LineItemDiscountRow
          index={index}
          productName={item.productName}
          showDiscount={showDiscount}
          hasActiveDiscount={hasActiveDiscount}
          discountType={item.discountType}
          displayDiscount={item.discountType === 'AMOUNT' ? paiseToRupees(item.discountValue) : item.discountValue}
          calculatedDiscountPaise={discountAmount}
          readOnly={isFree}
          discountLabel={t.discount || 'Discount'}
          onSelectType={(type) => onUpdate(index, { discountType: type, discountValue: 0 })}
          onValueChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onUpdate(index, { discountValue: 0 })
              return
            }
            const val = parseFloat(raw)
            if (!isNaN(val) && val >= 0) {
              onUpdate(index, { discountValue: item.discountType === 'AMOUNT' ? rupeesToPaise(val) : val })
            }
          }}
          onRemove={() => {
            onUpdate(index, { discountValue: 0 })
            setShowDiscount(false)
          }}
        />
      )}

      {/* Rate and Pricing Source fields (only when Rate pill chevron is clicked) */}
      {!forceCollapsed && rateExpanded && (
        <LineItemExpandedFields
          index={index}
          rate={item.rate}
          isFree={isFree}
          priceSource={priceSource}
          priceListName={priceTier?.name}
          priceListId={priceTier?.id}
          onResetPrice={handleResetPrice}
          onRateChange={handleRateChange}
          showProfit={showProfit}
          profit={item.profit}
          profitPercent={item.profitPercent}
        />
      )}
    </div>
  )
}

export type { PriceMode }
