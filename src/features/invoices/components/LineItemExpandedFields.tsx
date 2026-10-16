import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { paiseToRupees } from '../invoice-format.utils'
import { PriceSourceHint } from '@/features/price-lists/PriceSourceHint'
import type { PriceResolverResult } from '@/features/price-lists/pricing-resolver'
import { Input } from '@/components/ui/Input'

interface LineItemExpandedFieldsProps {
  index: number
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
}

export const LineItemExpandedFields: React.FC<LineItemExpandedFieldsProps> = ({
  index,
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
    <div className="line-item-expanded-panel">
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-[200px]">
          <label
            className="line-item-expanded-panel__label"
            htmlFor={`line-rate-${index}`}
          >
            {t.rateRs || 'Custom Rate (₹)'}
          </label>
          <div className="relative flex items-center">
            <span className="line-item-discount-panel__currency-prefix">
              ₹
            </span>
            <Input
              id={`line-rate-${index}`}
              type="number"
              className="input line-item-discount-panel__input"
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
        <div className="line-item-expanded-panel__footer">
          <span className="font-semibold text-secondary">Margin / Profit</span>
          <span
            className={`font-bold tabular-nums ${
              profit >= 0 ? 'text-success' : 'text-danger'
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
