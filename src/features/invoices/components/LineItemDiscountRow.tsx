import React from 'react'
import { X, Tag } from 'lucide-react'
import type { DiscountType } from '../invoice.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const DISCOUNT_TYPES: DiscountType[] = ['AMOUNT', 'PERCENTAGE']

interface LineItemDiscountRowProps {
  index: number
  productName: string
  showDiscount: boolean
  hasActiveDiscount: boolean
  discountType: DiscountType
  displayDiscount: number
  calculatedDiscountPaise?: number
  readOnly: boolean
  addDiscountLabel?: string
  discountLabel: string
  onOpen?: () => void
  onSelectType: (type: DiscountType) => void
  onValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}

export const LineItemDiscountRow: React.FC<LineItemDiscountRowProps> = ({
  index,
  productName,
  showDiscount,
  discountType,
  displayDiscount,
  calculatedDiscountPaise,
  readOnly,
  discountLabel,
  onSelectType,
  onValueChange,
  onRemove,
}) => {
  if (!showDiscount) {
    return null
  }

  return (
    <div className="line-item-discount-panel">
      <div className="flex items-center gap-2">
        <div className="line-item-discount-panel__badge">
          <Tag size={13} aria-hidden="true" />
        </div>
        <span className="line-item-discount-panel__title">
          {discountLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap sm:flex-nowrap">
        {/* Segmented Type Toggle */}
        <div
          className="line-item-discount-panel__toggle-group"
          role="group"
          aria-label="Discount Type"
        >
          {DISCOUNT_TYPES.map((type) => (
            <Button
              key={type}
              variant="none"
              type="button"
              onClick={() => onSelectType(type)}
              disabled={readOnly}
              className={`line-item-discount-panel__type-btn ${
                discountType === type
                  ? 'line-item-discount-panel__type-btn--active'
                  : ''
              }`}
            >
              {type === 'AMOUNT' ? '₹ Flat' : '% Off'}
            </Button>
          ))}
        </div>

        {/* Value Input */}
        <div className="line-item-discount-panel__input-box">
          <span className="line-item-discount-panel__currency-prefix">
            {discountType === 'AMOUNT' ? '₹' : '%'}
          </span>
          <Input
            id={`line-discount-${index}`}
            type="number"
            className="input line-item-discount-panel__input"
            value={displayDiscount === 0 ? '' : displayDiscount}
            placeholder="0"
            min={0}
            max={discountType === 'PERCENTAGE' ? 100 : undefined}
            step={0.01}
            disabled={readOnly}
            onChange={onValueChange}
            onFocus={(e) => e.target.select()}
            aria-label={`${discountLabel} ${productName}`}
          />
        </div>

        {/* Calculated amount preview */}
        {calculatedDiscountPaise !== undefined && calculatedDiscountPaise > 0 && (
          <span className="line-item-discount-panel__preview">
            -₹{(calculatedDiscountPaise / 100).toFixed(2)}
          </span>
        )}

        {/* Remove/Close button */}
        <Button
          variant="none"
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          className="line-item-discount-panel__close-btn"
          title="Close discount"
          aria-label="Close discount"
        >
          <X size={15} />
        </Button>
      </div>
    </div>
  )
}

