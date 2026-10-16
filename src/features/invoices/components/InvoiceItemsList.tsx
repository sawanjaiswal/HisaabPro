import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { LineItemEditor } from './LineItemEditor'
import { TaxPickerColumn } from './TaxPickerColumn'
import { HsnTypeahead } from './HsnTypeahead'
import { calculateLineTotal } from '../invoice-calc.utils'
import { calculateLineProfit } from '../invoice-totals.utils'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { LineItemFormData } from '../invoice.types'
import type { PriceListDetail } from '@/features/price-lists/price-list.types'
import type { PriceMode } from './useLinePriceMeta'

interface InvoiceItemsListProps {
  lineItems: LineItemFormData[]
  productNames: Record<string, string>
  lineMeta: Array<{ mode: PriceMode; salePrice: number }>
  isEditMode: boolean
  tier: PriceListDetail | null
  partyPricing: Record<string, { price: number; minQty: number }> | null
  canMarkFree: boolean
  gstEnabled: boolean
  compositionScheme: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  onUpdateLineItem: (index: number, item: Partial<LineItemFormData>) => void
  onRemoveLineItem: (index: number) => void
  onPriceModeChange: (index: number, mode: PriceMode) => void
  onEditProduct: (productId: string) => void
}

export const InvoiceItemsList: React.FC<InvoiceItemsListProps> = ({
  lineItems,
  productNames,
  lineMeta,
  isEditMode,
  tier,
  partyPricing,
  canMarkFree,
  gstEnabled,
  compositionScheme,
  isCollapsed,
  onToggleCollapse,
  onUpdateLineItem,
  onRemoveLineItem,
  onPriceModeChange,
  onEditProduct,
}) => {
  const { t } = useLanguage()

  const totalPaise = lineItems.reduce((sum, item) => {
    const { lineTotal } = calculateLineTotal(item.quantity, item.rate, item.discountType, item.discountValue)
    return sum + (item.isFreeItem ? 0 : lineTotal)
  }, 0)

  if (isCollapsed && lineItems.length > 0) {
    return (
      <div
        onClick={onToggleCollapse}
        className="p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between cursor-pointer hover:border-[var(--color-primary-500)] transition-all shadow-xs"
        role="button"
        tabIndex={0}
        aria-label="Expand items list"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
          <span>{lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}</span>
          <span className="text-[var(--color-text-secondary)] font-normal">·</span>
          <span className="text-[var(--color-primary-700)] dark:text-emerald-400 font-extrabold">
            {formatInvoiceAmount(totalPaise)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-[var(--color-primary-600)]">
          <span>View items</span>
          <ChevronDown size={15} />
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
      {lineItems.map((item, index) => {
        const { lineTotal, discountAmount } = calculateLineTotal(
          item.quantity,
          item.rate,
          item.discountType,
          item.discountValue,
        )
        const { profit, profitPercent } = calculateLineProfit(item.rate, 0, item.quantity, discountAmount)
        const meta = lineMeta[index] ?? {
          mode: isEditMode ? ('EDITED' as PriceMode) : ('AUTO' as PriceMode),
          salePrice: 0,
        }

        return (
          <div key={item.productId} className="line-item-with-gst">
            <LineItemEditor
              item={{
                ...item,
                productName: productNames[item.productId] ?? `${t.item} ${index + 1}`,
                discountAmount,
                lineTotal,
                profit,
                profitPercent,
              }}
              index={index}
              onUpdate={onUpdateLineItem}
              onRemove={onRemoveLineItem}
              onEditProduct={onEditProduct}
              showProfit={false}
              canMarkFree={canMarkFree}
              priceTier={tier}
              partyPricing={partyPricing}
              productSalePrice={meta.salePrice || undefined}
              priceMode={meta.mode}
              onPriceModeChange={onPriceModeChange}
            />
            {gstEnabled && (
              <div className="line-item-gst-row pb-3">
                {!compositionScheme && (
                  <TaxPickerColumn
                    lineIndex={index}
                    taxCategoryId={item.taxCategoryId}
                    compositionScheme={compositionScheme}
                    onChange={(id) => onUpdateLineItem(index, { taxCategoryId: id })}
                  />
                )}
                <HsnTypeahead
                  lineIndex={index}
                  value={item.hsnCode ?? ''}
                  onSelect={(code) => onUpdateLineItem(index, { hsnCode: code })}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
