import React from 'react'
import { X, Tag } from 'lucide-react'
import type { DiscountType } from '../invoice.types'
import { DISCOUNT_TYPE_LABELS } from '../invoice.constants'
import { Input } from '@/components/ui/Input'

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
  hasActiveDiscount,
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
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[var(--color-primary-50)]/60 dark:bg-emerald-950/20 border border-[var(--color-primary-200)]/70 dark:border-emerald-900/50 mt-2 transition-all">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] flex items-center justify-center shrink-0">
          <Tag size={13} aria-hidden="true" />
        </div>
        <span className="text-xs font-bold text-[var(--color-text-primary)]">
          {discountLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap sm:flex-nowrap">
        {/* Segmented Type Toggle */}
        <div
          className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shrink-0 shadow-2xs"
          role="group"
          aria-label="Discount Type"
        >
          {DISCOUNT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType(type)}
              disabled={readOnly}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer border-0 ${
                discountType === type
                  ? 'bg-[var(--color-primary-600)] text-white shadow-2xs'
                  : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {type === 'AMOUNT' ? '₹ Flat' : '% Off'}
            </button>
          ))}
        </div>

        {/* Value Input */}
        <div className="relative flex-1 min-w-[90px] max-w-[130px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-muted)] pointer-events-none select-none">
            {discountType === 'AMOUNT' ? '₹' : '%'}
          </span>
          <Input
            id={`line-discount-${index}`}
            type="number"
            className="input min-h-[34px] h-[34px] pl-6 pr-2 text-xs font-bold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--color-primary-500)]"
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
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 whitespace-nowrap">
            -₹{(calculatedDiscountPaise / 100).toFixed(2)}
          </span>
        )}

        {/* Remove/Close button */}
        <button
          type="button"
          onClick={onRemove}
          disabled={readOnly}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error-600)] hover:bg-[var(--color-error-50)] dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer border-0 bg-transparent shrink-0"
          title="Close discount"
          aria-label="Close discount"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
