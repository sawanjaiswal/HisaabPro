import React, { useState, useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DiscountType } from '../invoice.types'
import { paiseToRupees, rupeesToPaise } from '../invoice-format.utils'
import { PriceSourceHint } from '@/features/price-lists/PriceSourceHint'
import type { PriceResolverResult } from '@/features/price-lists/pricing-resolver'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LineItemDiscountRow } from './LineItemDiscountRow'

interface LineItemFieldsProps {
  index: number
  productName: string
  quantity: number
  rate: number
  discountType: DiscountType
  discountValue: number
  readOnly?: boolean
  onChange: (updates: { quantity?: number; rate?: number; discountType?: DiscountType; discountValue?: number }) => void
  priceSource?: PriceResolverResult['source']
  priceListName?: string
  priceListId?: string
  onResetPrice?: () => void
}

export const LineItemFields: React.FC<LineItemFieldsProps> = ({
  index,
  productName,
  quantity,
  rate,
  discountType,
  discountValue,
  readOnly = false,
  onChange,
  priceSource,
  priceListName,
  priceListId,
  onResetPrice,
}) => {
  const { t } = useLanguage()
  const [showDiscount, setShowDiscount] = useState(() => (discountValue ?? 0) > 0)

  const advanceOnEnter = useCallback(
    (nextId: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (['e', 'E', '+', '-'].includes(e.key)) {
        e.preventDefault()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const el = document.getElementById(nextId) as HTMLInputElement | null
        el?.focus()
        el?.select()
      }
    },
    [],
  )

  const decrementQty = useCallback(() => {
    const next = Math.max(0, (quantity || 0) - 1)
    onChange({ quantity: next })
  }, [quantity, onChange])

  const incrementQty = useCallback(() => {
    onChange({ quantity: (quantity || 0) + 1 })
  }, [quantity, onChange])

  const handleQuantity = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange({ quantity: 0 })
      return
    }
    const qty = parseFloat(raw)
    if (!isNaN(qty) && qty >= 0) onChange({ quantity: qty })
  }, [onChange])

  const handleRate = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange({ rate: 0 })
      return
    }
    const rupees = parseFloat(raw)
    if (!isNaN(rupees) && rupees >= 0) onChange({ rate: rupeesToPaise(rupees) })
  }, [onChange])

  const handleDiscountValue = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange({ discountValue: 0 })
      return
    }
    const val = parseFloat(raw)
    if (!isNaN(val) && val >= 0) {
      const next = discountType === 'AMOUNT' ? rupeesToPaise(val) : val
      onChange({ discountValue: next })
    }
  }, [discountType, onChange])

  const handleDiscountType = useCallback((type: DiscountType) => {
    onChange({ discountType: type, discountValue: 0 })
  }, [onChange])

  const handleRemoveDiscount = useCallback(() => {
    onChange({ discountValue: 0 })
    setShowDiscount(false)
  }, [onChange])

  const displayDiscount = discountType === 'AMOUNT' ? paiseToRupees(discountValue) : discountValue
  const hasActiveDiscount = (discountValue ?? 0) > 0

  return (
    <div className="space-y-3">
      {/* 2-Column primary grid: Qty & Rate */}
      <div className="grid grid-cols-2 gap-3">
        {/* Quantity Stepper */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]" htmlFor={`line-qty-${index}`}>
            {t.qty}
          </label>
          <div className="flex items-center rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] focus-within:bg-[var(--color-surface)] focus-within:border-[var(--color-primary-500)] focus-within:ring-2 focus-within:ring-[var(--color-primary-100)] transition-all min-h-[42px] overflow-hidden">
            <Button
              variant="none"
              type="button"
              onClick={decrementQty}
              disabled={readOnly || quantity <= 0}
              className="w-9 h-[42px] flex items-center justify-center text-[var(--color-gray-500)] hover:text-[var(--color-gray-800)] hover:bg-[var(--color-gray-100)] active:bg-[var(--color-gray-200)] transition-colors p-0 border-0 cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus size={13} />
            </Button>
            <Input
              id={`line-qty-${index}`}
              type="number"
              className="w-full text-center text-sm font-bold text-[var(--color-text-primary)] bg-transparent border-0 focus:outline-none p-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-none focus-visible:ring-0"
              value={quantity === 0 ? '' : quantity}
              placeholder="1"
              min={0}
              step={0.01}
              disabled={readOnly}
              onChange={handleQuantity}
              onFocus={(e) => e.target.select()}
              onKeyDown={advanceOnEnter(`line-rate-${index}`)}
              aria-label={`${t.quantityFor} ${productName}`}
            />
            <Button
              variant="none"
              type="button"
              onClick={incrementQty}
              disabled={readOnly}
              className="w-9 h-[42px] flex items-center justify-center text-[var(--color-gray-500)] hover:text-[var(--color-gray-800)] hover:bg-[var(--color-gray-100)] active:bg-[var(--color-gray-200)] transition-colors p-0 border-0 cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus size={13} />
            </Button>
          </div>
        </div>

        {/* Rate (Rupees) */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]" htmlFor={`line-rate-${index}`}>
            {t.rateRs}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-bold text-[var(--color-gray-500)] pointer-events-none select-none">
              ₹
            </span>
            <Input
              id={`line-rate-${index}`}
              type="number"
              className="input pl-8 min-h-[42px] text-sm font-bold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={rate === 0 ? '' : paiseToRupees(rate)}
              placeholder="0.00"
              min={0}
              step={0.01}
              disabled={readOnly}
              onChange={handleRate}
              onFocus={(e) => e.target.select()}
              onKeyDown={advanceOnEnter(`line-discount-${index}`)}
              aria-label={`${t.rateInRupeesFor} ${productName}`}
            />
          </div>
          {priceSource && priceSource !== 'PRODUCT_DEFAULT' && onResetPrice && (
            <PriceSourceHint
              source={priceSource}
              listName={priceListName}
              listId={priceListId}
              onReset={onResetPrice}
            />
          )}
        </div>
      </div>

      {/* Secondary: Unobtrusive Discount Row */}
      <LineItemDiscountRow
        index={index}
        productName={productName}
        showDiscount={showDiscount}
        hasActiveDiscount={hasActiveDiscount}
        discountType={discountType}
        displayDiscount={displayDiscount}
        readOnly={readOnly}
        addDiscountLabel={`+ ${t.discount}`}
        discountLabel={t.discount}
        onOpen={() => setShowDiscount(true)}
        onSelectType={handleDiscountType}
        onValueChange={handleDiscountValue}
        onRemove={handleRemoveDiscount}
      />
    </div>
  )
}
