/** Invoice Items Section — shared between Create & Edit Invoice pages
 *
 * Renders: party search, line item editors, stock warnings, product search toggle.
 * GST Phase 2: TaxPickerColumn + HsnTypeahead conditionally rendered per line.
 * All amounts in PAISE.
 */

import { Plus, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { LineItemEditor } from './LineItemEditor'
import { useBogoPermission } from '../useBogoPermission'
import { PartySearchInput } from './PartySearchInput'
import { ProductSearchInput } from './ProductSearchInput'
import { TaxPickerColumn } from './TaxPickerColumn'
import { HsnTypeahead } from './HsnTypeahead'
import { calculateLineTotal } from '../invoice-calc.utils'
import { calculateLineProfit } from '../invoice-totals.utils'
import type { LineItemFormData } from '../invoice.types'
import type { StockValidationItem } from '../invoice.service'

interface InvoiceItemsSectionProps {
  partyId: string
  lineItems: LineItemFormData[]
  productNames: Record<string, string>
  showProductSearch: boolean
  errors: Record<string, string>
  stockWarnings: StockValidationItem[]
  hasStockBlocks: boolean
  /** GST Phase 2 — when true, tax picker and HSN columns are shown */
  gstEnabled?: boolean
  /** GST Phase 2 — when true, tax picker is hidden (composition scheme) */
  compositionScheme?: boolean
  onPartyChange: (id: string, name: string) => void
  onProductSelect: (productId: string, ratePaise: number, productName: string) => void
  onUpdateLineItem: (index: number, item: Partial<LineItemFormData>) => void
  onRemoveLineItem: (index: number) => void
  onToggleProductSearch: () => void
}

export function InvoiceItemsSection({
  partyId,
  lineItems,
  productNames,
  showProductSearch,
  errors,
  stockWarnings,
  hasStockBlocks,
  gstEnabled = false,
  compositionScheme = false,
  onPartyChange,
  onProductSelect,
  onUpdateLineItem,
  onRemoveLineItem,
  onToggleProductSearch,
}: InvoiceItemsSectionProps) {
  const { t } = useLanguage()
  const canMarkFree = useBogoPermission()
  const addedProductIds = lineItems.map((item) => item.productId)

  return (
    <div className="line-items-section py-0">
      <PartySearchInput
        value={partyId}
        onChange={onPartyChange}
        error={errors.partyId}
      />

      {lineItems.map((item, index) => {
        const { lineTotal, discountAmount } = calculateLineTotal(
          item.quantity,
          item.rate,
          item.discountType,
          item.discountValue,
        )
        const { profit, profitPercent } = calculateLineProfit(
          item.rate,
          0,
          item.quantity,
          discountAmount,
        )
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
              showProfit={false}
              canMarkFree={canMarkFree}
            />

            {gstEnabled && (
              <div className="line-item-gst-row">
                {!compositionScheme && (
                  <TaxPickerColumn
                    lineIndex={index}
                    taxCategoryId={item.taxCategoryId}
                    isNewLine={true}
                    compositionScheme={compositionScheme}
                    onChange={(id) => onUpdateLineItem(index, { taxCategoryId: id })}
                  />
                )}
                <HsnTypeahead
                  lineIndex={index}
                  value={item.hsnCode ?? ''}
                  onSelect={(code, _rate) => onUpdateLineItem(index, { hsnCode: code })}
                />
              </div>
            )}
          </div>
        )
      })}

      {errors.lineItems && (
        <span className="field-error" role="alert">{errors.lineItems}</span>
      )}

      {stockWarnings.length > 0 && (
        <div className={`stock-warnings${hasStockBlocks ? ' stock-warnings--block' : ''}`} role="alert">
          <div className="stock-warnings-title">
            <AlertTriangle size={16} aria-hidden="true" />
            {hasStockBlocks ? t.insufficientStock : t.lowStockWarning}
          </div>
          {stockWarnings.map((w) => (
            <div key={w.productId} className="stock-warning-item">
              <span className="stock-warning-name">{w.productName}</span>
              <span className="stock-warning-detail">
                {w.currentStock} {w.requestedUnit} {t.availableLabel}, {w.requestedQty} {t.requestedLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      {errors.stock && (
        <span className="field-error" role="alert">{errors.stock}</span>
      )}

      {showProductSearch && (
        <div className="product-search-panel py-0">
          <ProductSearchInput
            onSelect={onProductSelect}
            addedProductIds={addedProductIds}
          />
        </div>
      )}

      <button
        type="button"
        className="add-item-btn"
        onClick={onToggleProductSearch}
        aria-label={showProductSearch ? t.hideProductSearch : t.addLineItemLabel}
        aria-expanded={showProductSearch}
      >
        <Plus size={18} aria-hidden="true" />
        {showProductSearch ? t.hideSearch : t.addItem}
      </button>
    </div>
  )
}
