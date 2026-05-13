/** Qty / Rate / Discount fields for a single line item */

import React, { useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DiscountType } from '../invoice.types'
import { paiseToRupees, rupeesToPaise } from '../invoice-format.utils'
import { DISCOUNT_TYPE_LABELS } from '../invoice.constants'

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
}) => {
  const { t } = useLanguage()

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
        <input
          id={`line-qty-${index}`}
          type="number"
          className="input"
          value={quantity}
          min={0.001}
          step={0.001}
          onChange={handleQuantity}
          aria-label={`${t.quantityFor} ${productName}`}
        />
      </div>

      <div className="line-item-field">
        <label className="line-item-field-label" htmlFor={`line-rate-${index}`}>{t.rateRs}</label>
        <input
          id={`line-rate-${index}`}
          type="number"
          className="input"
          value={paiseToRupees(rate)}
          min={0}
          step={0.01}
          disabled={readOnly}
          onChange={handleRate}
          aria-label={`${t.rateInRupeesFor} ${productName}`}
        />
      </div>

      <div className="line-item-field">
        <label className="line-item-field-label" htmlFor={`line-discount-${index}`}>{t.discount}</label>
        <div className="discount-toggle">
          <div className="discount-toggle" role="group" aria-label={`${t.discountTypeFor} ${productName}`}>
            {DISCOUNT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`discount-toggle-btn${discountType === type ? ' active' : ''}`}
                onClick={() => handleDiscountType(type)}
                disabled={readOnly}
                aria-pressed={discountType === type}
                aria-label={type === 'AMOUNT' ? t.setDiscountAsAmount : t.setDiscountAsPercentage}
              >
                {DISCOUNT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <input
            id={`line-discount-${index}`}
            type="number"
            className="input"
            value={displayDiscount}
            min={0}
            max={discountType === 'PERCENTAGE' ? 100 : undefined}
            step={0.01}
            disabled={readOnly}
            onChange={handleDiscountValue}
            aria-label={`${t.discount} ${discountType === 'AMOUNT' ? t.discountAmountFor : t.discountPercentFor} ${productName}`}
          />
        </div>
      </div>
    </div>
  )
}
