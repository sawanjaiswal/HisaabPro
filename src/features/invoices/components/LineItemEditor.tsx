/** LineItemEditor — single editable line item card matching modern fintech design (SSOT) */
import React, { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { LineItemFormData } from '../invoice.types'
import { formatInvoiceAmount, paiseToRupees, rupeesToPaise } from '../invoice-format.utils'
import { calculateLineTotal } from '../invoice-calc.utils'
import { LineItemBatchPicker } from './LineItemBatchPicker'
import { LineItemExpandedFields } from './LineItemExpandedFields'
import { LineItemDiscountRow } from './LineItemDiscountRow'
import { LineItemActionIcons } from './LineItemActionIcons'
import { useLineItemResolver } from './useLineItemResolver'
import { useLineItemProductInfo } from './useLineItemProductInfo'
import { getAvatarColor } from '@/components/ui/PartyAvatar'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
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
  const avatarBg = getAvatarColor(item.productName)

  return (
    <div
      className={`p-3.5 my-2 rounded-2xl border transition-all ${
        isFree
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
          : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
      }`}
      aria-label={`Line item ${index + 1}: ${item.productName}`}
    >
      {/* Top section: Avatar + Title & Stock on left, Subtotal on right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar Thumbnail */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm select-none border shadow-2xs"
            style={{
              backgroundColor: avatarBg,
              borderColor: 'rgba(0, 0, 0, 0.08)',
              color: '#0f172a',
            }}
          >
            {item.productName ? item.productName.charAt(0).toUpperCase() : 'P'}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm sm:text-base text-[var(--color-text-primary)] leading-tight truncate">
                {item.productName}
              </span>
              {isFree && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-success-50)] text-[var(--color-success-700)] text-[10px] font-bold shrink-0">
                  {t.freeItemBadge}
                </span>
              )}
            </div>

            {productMeta.sku && (
              <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                {productMeta.sku}
              </span>
            )}

            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[11px] font-medium ${
                  productMeta.currentStock !== null && productMeta.currentStock <= 0
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-[var(--color-text-secondary)]'
                }`}
              >
                Stock: {productMeta.currentStock !== null ? `${productMeta.currentStock.toFixed(1)} ${productMeta.unitSymbol}` : `0.0 ${productMeta.unitSymbol}`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Line Total Amount */}
        <div className="text-right shrink-0">
          <div className="text-sm sm:text-base font-extrabold text-[var(--color-text-primary)] tabular-nums">
            {formatInvoiceAmount(displayLineTotal)}
          </div>
          {hasActiveDiscount && (
            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Discount applied
            </div>
          )}
        </div>
      </div>

      {/* Controls row: Rate pill on left, Action Icons + Stepper on right */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--color-border)]/60 flex-wrap sm:flex-nowrap">
        {/* Left: Rate Pill with expand chevron */}
        <button
          type="button"
          onClick={() => setRateExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary-400)] transition-all cursor-pointer"
          aria-expanded={rateExpanded}
          aria-label={`${rateExpanded ? 'Hide' : 'Change'} rate for ${item.productName}`}
        >
          <span>₹ {paiseToRupees(item.rate)}/{productMeta.unitSymbol}</span>
          {rateExpanded ? (
            <ChevronUp size={13} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown size={13} className="text-[var(--color-text-muted)]" />
          )}
        </button>

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
        <div className="mt-2.5 pt-2 border-t border-[var(--color-border)]/60">
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
          productName={item.productName}
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
          displayLineTotal={displayLineTotal}
        />
      )}
    </div>
  )
}

export type { PriceMode }
