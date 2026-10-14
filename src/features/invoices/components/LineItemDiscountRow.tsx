import React from 'react'
import { Tag, X } from 'lucide-react'
import type { DiscountType } from '../invoice.types'
import { DISCOUNT_TYPE_LABELS } from '../invoice.constants'
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
  readOnly: boolean
  addDiscountLabel: string
  discountLabel: string
  onOpen: () => void
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
  readOnly,
  addDiscountLabel,
  discountLabel,
  onOpen,
  onSelectType,
  onValueChange,
  onRemove,
}) => {
  if (!showDiscount && !hasActiveDiscount) {
    return (
      <div className="flex items-center">
        <Button
          variant="none"
          type="button"
          onClick={onOpen}
          disabled={readOnly}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary-600)] transition-colors cursor-pointer py-0.5"
        >
          <Tag size={12} className="text-[var(--color-gray-400)]" />
          <span>{addDiscountLabel}</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <div
        className="flex items-center gap-1 rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] p-0.5"
        role="group"
        aria-label="Discount Type"
      >
        {DISCOUNT_TYPES.map((type) => (
          <Button
            variant="none"
            key={type}
            type="button"
            onClick={() => onSelectType(type)}
            disabled={readOnly}
            className={`px-2 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              hasActiveDiscount && discountType === type
                ? 'bg-[var(--color-primary-600)] text-white shadow-xs'
                : discountType === type
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {DISCOUNT_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      <div className="relative flex-1 max-w-[130px]">
        <Input
          id={`line-discount-${index}`}
          type="number"
          className="input min-h-[36px] text-xs font-bold tabular-nums px-2.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

      <Button
        variant="none"
        type="button"
        onClick={onRemove}
        disabled={readOnly}
        className="p-1 text-[var(--color-gray-400)] hover:text-[var(--color-error-500)] rounded transition-colors"
        title="Remove discount"
        aria-label="Remove discount"
      >
        <X size={14} />
      </Button>
    </div>
  )
}
