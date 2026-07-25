/** Qty / Rate / Discount fields for a single line item */

import React, { useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DiscountType } from '../invoice.types'
import { paiseToRupees, rupeesToPaise } from '../invoice-format.utils'
import { DISCOUNT_TYPE_LABELS } from '../invoice.constants'
import { PriceSourceHint } from '@/features/price-lists/PriceSourceHint'
import type { PriceResolverResult } from '@/features/price-lists/pricing-resolver'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const DISCOUNT_TYPES: DiscountType[] = ['AMOUNT', 'PERCENTAGE']

interface LineItemFieldsProps {
  index: number
  productName: string
  quantity: number
  rate: number
  discountType: DiscountType
  discountValue: number
  /** When true, rate/discount fields are disabled (free item) */
  readOnly?: boolean
  onChange: (updates: { quantity?: number; rate?: number; discountType?: DiscountType; discountValue?: number }) => void
  /** #132 Batch 6 — price resolution source for hint display */
  priceSource?: PriceResolverResult['source']
  /** #132 Batch 6 — name of the price list (when source = TIER) */
  priceListName?: string
  /** #132 Batch 6 — id of the price list (when source = TIER) */
  priceListId?: string
  /** #132 Batch 6 — called when user clicks "Reset to auto" */
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

  // Rapid-entry keyboard flow: Enter walks qty → rate → discount → next row's
  // qty, and every number field blocks the e/E/+/- characters the native
  // number input would otherwise accept. Focus-by-id keeps this decoupled from
  // refs across the row/section boundary; `.select()` primes the field for
  // immediate overtype. Last row's discount-Enter simply finds no next qty and
  // stops — the seller taps "Add item" (or scans) to open a new line.
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

  const handleQuantity = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseFloat(e.target.value)
    if (!isNaN(qty) && qty >= 0.001) onChange({ quantity: qty })
  }, [onChange])

  const handleRate = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rupees = parseFloat(e.target.value)
    if (!isNaN(rupees) && rupees >= 0) onChange({ rate: rupeesToPaise(rupees) })
  }, [onChange])

  const handleDiscountValue = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (!isNaN(val) && val >= 0) {
      const next = discountType === 'AMOUNT' ? rupeesToPaise(val) : val
      onChange({ discountValue: next })
    }
  }, [discountType, onChange])

  const handleDiscountType = useCallback((type: DiscountType) => {
    onChange({ discountType: type, discountValue: 0 })
  }, [onChange])

  const displayDiscount = discountType === 'AMOUNT' ? paiseToRupees(discountValue) : discountValue

  return (
    <div className="line-item-fields">
      <div className="line-item-field">
        <label className="line-item-field-label" htmlFor={`line-qty-${index}`}>{t.qty}</label>
        <Input
          id={`line-qty-${index}`}
          type="number"
          className="input"
          value={quantity}
          min={0.001}
          step={0.001}
          onChange={handleQuantity}
          onKeyDown={advanceOnEnter(`line-rate-${index}`)}
          aria-label={`${t.quantityFor} ${productName}`}
        />
      </div>

      <div className="line-item-field">
        <label className="line-item-field-label" htmlFor={`line-rate-${index}`}>{t.rateRs}</label>
        <Input
          id={`line-rate-${index}`}
          type="number"
          className="input"
          value={paiseToRupees(rate)}
          min={0}
          step={0.01}
          disabled={readOnly}
          onChange={handleRate}
          onKeyDown={advanceOnEnter(`line-discount-${index}`)}
          aria-label={`${t.rateInRupeesFor} ${productName}`}
        />
        {priceSource && priceSource !== 'PRODUCT_DEFAULT' && onResetPrice && (
          <PriceSourceHint
            source={priceSource}
            listName={priceListName}
            listId={priceListId}
            onReset={onResetPrice}
          />
        )}
      </div>

      <div className="line-item-field">
        <label className="line-item-field-label" htmlFor={`line-discount-${index}`}>{t.discount}</label>
        <div className="discount-toggle">
          <div className="discount-toggle" role="group" aria-label={`${t.discountTypeFor} ${productName}`}>
            {DISCOUNT_TYPES.map((type) => (
              <Button variant="none"
                key={type}
                type="button"
                className={`discount-toggle-btn${discountType === type ? ' active' : ''}`}
                onClick={() => handleDiscountType(type)}
                disabled={readOnly}
                aria-pressed={discountType === type}
                aria-label={type === 'AMOUNT' ? t.setDiscountAsAmount : t.setDiscountAsPercentage}
              >
                {DISCOUNT_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
          <Input
            id={`line-discount-${index}`}
            type="number"
            className="input"
            value={displayDiscount}
            min={0}
            max={discountType === 'PERCENTAGE' ? 100 : undefined}
            step={0.01}
            disabled={readOnly}
            onChange={handleDiscountValue}
            onKeyDown={advanceOnEnter(`line-qty-${index + 1}`)}
            aria-label={`${t.discount} ${discountType === 'AMOUNT' ? t.discountAmountFor : t.discountPercentFor} ${productName}`}
          />
        </div>
      </div>
    </div>
  )
}
