import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToRupees } from '../invoice-format.utils'
import { PriceSourceHint } from '@/features/price-lists/PriceSourceHint'
import type { PriceResolverResult } from '@/features/price-lists/pricing-resolver'
import { Input } from '@/components/ui/Input'

interface LineItemExpandedFieldsProps {
  index: number
  productName: string
  rate: number
  isFree: boolean
  priceSource?: PriceResolverResult['source']
  priceListName?: string
  priceListId?: string
  onResetPrice?: () => void
  onRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  showProfit: boolean
  profit: number
  profitPercent: number
  displayLineTotal: number
}

export const LineItemExpandedFields: React.FC<LineItemExpandedFieldsProps> = ({
  index,
  productName,
  rate,
  isFree,
  priceSource,
  priceListName,
  priceListId,
  onResetPrice,
  onRateChange,
  showProfit,
  profit,
  profitPercent,
}) => {
  const { t } = useLanguage()

  return (
    <div className="mt-2 p-2.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-2.5 transition-all">
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-[200px]">
          <label
            className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] block mb-1"
            htmlFor={`line-rate-${index}`}
          >
            {t.rateRs || 'Custom Rate (₹)'}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-xs font-bold text-[var(--color-text-muted)] pointer-events-none select-none">
              ₹
            </span>
            <Input
              id={`line-rate-${index}`}
              type="number"
              className="input pl-7 min-h-[34px] h-[34px] text-xs font-bold tabular-nums bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--color-primary-500)]"
              value={rate === 0 ? '' : paiseToRupees(rate)}
              placeholder="0.00"
              min={0}
              step={0.01}
              disabled={isFree}
              onChange={onRateChange}
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
        {priceSource && priceSource !== 'PRODUCT_DEFAULT' && onResetPrice && (
          <div className="pt-4">
            <PriceSourceHint
              source={priceSource}
              listName={priceListName}
              listId={priceListId}
              onReset={onResetPrice}
            />
          </div>
        )}
      </div>

      {showProfit && !isFree && (
        <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border)]/60 text-xs">
          <span className="font-semibold text-[var(--color-text-secondary)]">Margin / Profit</span>
          <span
            className={`font-bold tabular-nums ${
              profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {profit >= 0 ? '+' : ''}
            {profitPercent.toFixed(1)}% (₹{(profit / 100).toFixed(2)})
          </span>
        </div>
      )}
    </div>
  )
}
