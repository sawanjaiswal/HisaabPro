/** Invoice Items Section — party search + price-list override chip (Epic B PR2)
 * + line item editors, stock warnings, product search toggle.
 * GST Phase 2: TaxPickerColumn + HsnTypeahead conditionally per line.
 * #132 Batch 6: usePartyTier drives client-side price resolution per line.
 */

import { useCallback } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { LineItemEditor } from './LineItemEditor'
import { useLinePriceMeta } from './useLinePriceMeta'
import { useBogoPermission } from '../useBogoPermission'
import { PartySearchInput } from './PartySearchInput'
import { FormSection } from '@/components/ui/FormSection'
import { ProductSearchInput } from './ProductSearchInput'
import { TaxPickerColumn } from './TaxPickerColumn'
import { HsnTypeahead } from './HsnTypeahead'
import { calculateLineTotal } from '../invoice-calc.utils'
import { calculateLineProfit } from '../invoice-totals.utils'
import { usePartyTier } from '@/features/price-lists/use-party-tier'
import { usePriceListOverride } from '@/features/pricing/usePriceListOverride'
import { PriceListOverrideSelector } from '@/features/pricing/components/PriceListOverrideSelector'
import type { LineItemFormData } from '../invoice.types'
import type { StockValidationItem } from '../invoice.service'
import type { PriceMode } from './useLinePriceMeta'
import { Button } from '@/components/ui/Button'

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
  /** #132 Batch 6 — when true, existing lines start as EDITED so rates are not auto-replaced. */
  isEditMode?: boolean
  /** Epic B PR2 — current price-list override id from form state (null = party default) */
  priceListId?: string | null
  /** Epic B PR2 — called when user changes the tier override */
  onPriceListChange?: (id: string | null) => void
  onPartyChange: (id: string, name: string) => void
  onProductSelect: (productId: string, ratePaise: number, productName: string, salePricePaise?: number) => void
  onUpdateLineItem: (index: number, item: Partial<LineItemFormData>) => void
  onRemoveLineItem: (index: number) => void
  onToggleProductSearch: () => void
}

// Stable no-op for optional onPriceListChange
const noop = (_id: string | null) => { /* no-op */ }

export function InvoiceItemsSection({
  partyId, lineItems, productNames, showProductSearch, errors,
  stockWarnings, hasStockBlocks, gstEnabled = false,
  compositionScheme = false, isEditMode = false,
  priceListId = null, onPriceListChange,
  onPartyChange, onProductSelect, onUpdateLineItem,
  onRemoveLineItem, onToggleProductSearch,
}: InvoiceItemsSectionProps) {
  const { t } = useLanguage()
  const canMarkFree = useBogoPermission()

  const { tier: partyTier, partyPricing, status: tierStatus } = usePartyTier(partyId)
  const partyDefaultListId = tierStatus === 'success' ? (partyTier?.id ?? null) : null

  const {
    availableLists, listsLoading, effectiveTier,
    selectedListId, displayName, isOverridden, setOverride, resetOverride,
  } = usePriceListOverride({
    partyDefaultListId,
    initialOverrideId: priceListId,
    onOverrideChange: onPriceListChange ?? noop,
  })

  const tier = effectiveTier ?? partyTier

  const { lineMeta, handlePriceModeChange, appendMeta } = useLinePriceMeta({
    lineItems, partyId, isEditMode, tier, partyPricing, onUpdateLineItem,
  })

  const handleProductSelect = useCallback(
    (productId: string, ratePaise: number, productName: string, salePricePaise?: number) => {
      appendMeta(salePricePaise ?? ratePaise)
      onProductSelect(productId, ratePaise, productName, salePricePaise)
    },
    [appendMeta, onProductSelect],
  )

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
    <div className="line-items-section py-0 space-y-6">
      <FormSection title={t.customer}>
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} showLabel={false} />

        {partyId && (
          <PriceListOverrideSelector
            availableLists={availableLists}
            loading={listsLoading}
            selectedListId={selectedListId}
            partyDefaultListId={partyDefaultListId}
            displayName={displayName}
            isOverridden={isOverridden}
            onSelect={setOverride}
            onReset={resetOverride}
          />
        )}
      </FormSection>

      <FormSection
        title={t.sectionItems}
        action={
          <Button variant="none"
            type="button"
            className="form-section-action"
            onClick={onToggleProductSearch}
            aria-label={showProductSearch ? t.hideProductSearch : t.addLineItemLabel}
            aria-expanded={showProductSearch}
          >
            <Plus size={16} aria-hidden="true" />
            {showProductSearch ? t.hideSearch : t.addItem}
          </Button>
        }
      >
      {lineItems.map((item, index) => {
        const { lineTotal, discountAmount } = calculateLineTotal(
          item.quantity, item.rate, item.discountType, item.discountValue,
        )
        const { profit, profitPercent } = calculateLineProfit(item.rate, 0, item.quantity, discountAmount)
        const meta = lineMeta[index] ?? { mode: isEditMode ? ('EDITED' as PriceMode) : ('AUTO' as PriceMode), salePrice: 0 }

        return (
          <div key={item.productId} className="line-item-with-gst">
            <LineItemEditor
              item={{ ...item, productName: productNames[item.productId] ?? `${t.item} ${index + 1}`,
                discountAmount, lineTotal, profit, profitPercent }}
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

      {errors.lineItems && <span className="field-error" role="alert">{errors.lineItems}</span>}

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

      {errors.stock && <span className="field-error" role="alert">{errors.stock}</span>}

      {showProductSearch && (
        <div className="product-search-panel py-0">
          <ProductSearchInput onSelect={handleProductSelect} addedProductIds={addedProductIds} />
        </div>
      )}
      </FormSection>
    </div>
  )
}
