/** Invoice Items Section — shared between Create & Edit Invoice pages
 *
 * Renders: party search, line item editors, stock warnings, product search toggle.
 * GST Phase 2: TaxPickerColumn + HsnTypeahead conditionally rendered per line.
 * #132 Batch 6: usePartyTier drives client-side price resolution per line.
 * All amounts in PAISE.
 */

import { useCallback } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { LineItemEditor } from './LineItemEditor'
import { useLinePriceMeta } from './useLinePriceMeta'
import { useBogoPermission } from '../useBogoPermission'
import { PartySearchInput } from './PartySearchInput'
import { ProductSearchInput } from './ProductSearchInput'
import { TaxPickerColumn } from './TaxPickerColumn'
import { HsnTypeahead } from './HsnTypeahead'
import { calculateLineTotal } from '../invoice-calc.utils'
import { calculateLineProfit } from '../invoice-totals.utils'
import { usePartyTier } from '@/features/price-lists/use-party-tier'
import type { LineItemFormData } from '../invoice.types'
import type { StockValidationItem } from '../invoice.service'
import type { PriceMode } from './useLinePriceMeta'

interface InvoiceItemsSectionProps {
  partyId: string
  lineItems: LineItemFormData[]
  productNames: Record<string, string>
  showProductSearch: boolean
  errors: Record<string, string>
  stockWarnings: StockValidationItem[]
  hasStockBlocks: boolean
  gstEnabled?: boolean
  compositionScheme?: boolean
  /**
   * #132 Batch 6 — when true, existing invoice lines start as EDITED
   * so rates are not auto-replaced on load.
   */
  isEditMode?: boolean
  onPartyChange: (id: string, name: string) => void
  onProductSelect: (productId: string, ratePaise: number, productName: string, salePricePaise?: number) => void
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
  isEditMode = false,
  onPartyChange,
  onProductSelect,
  onUpdateLineItem,
  onRemoveLineItem,
  onToggleProductSearch,
}: InvoiceItemsSectionProps) {
  const { t } = useLanguage()
  const canMarkFree = useBogoPermission()

  // ─── Price-list tier for the selected party ────────────────────────────────

  const { tier, partyPricing } = usePartyTier(partyId)

  // ─── Per-line price metadata (mode + salePrice at add time) ───────────────

  const { lineMeta, handlePriceModeChange, appendMeta } = useLinePriceMeta({
    lineItems,
    partyId,
    isEditMode,
    tier,
    partyPricing,
    onUpdateLineItem,
  })

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // Intercept product select to record salePrice in lineMeta
  const handleProductSelect = useCallback(
    (productId: string, ratePaise: number, productName: string, salePricePaise?: number) => {
      appendMeta(salePricePaise ?? ratePaise)
      onProductSelect(productId, ratePaise, productName, salePricePaise)
    },
    [appendMeta, onProductSelect],
  )

  // Reset priceMode to AUTO when productId changes on existing row
  const handleUpdateLineItem = useCallback(
    (index: number, updates: Partial<LineItemFormData>) => {
      if ('productId' in updates && updates.productId !== lineItems[index]?.productId) {
        handlePriceModeChange(index, 'AUTO' as PriceMode)
      }
      onUpdateLineItem(index, updates)
    },
    [lineItems, onUpdateLineItem, handlePriceModeChange],
  )

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
        const meta = lineMeta[index] ?? { mode: isEditMode ? ('EDITED' as PriceMode) : ('AUTO' as PriceMode), salePrice: 0 }

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
              onUpdate={handleUpdateLineItem}
              onRemove={onRemoveLineItem}
              showProfit={false}
              canMarkFree={canMarkFree}
              priceTier={tier}
              partyPricing={partyPricing}
              productSalePrice={meta.salePrice || undefined}
              priceMode={meta.mode}
              onPriceModeChange={handlePriceModeChange}
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
            onSelect={handleProductSelect}
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
