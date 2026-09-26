import { useCallback } from 'react'
import { Plus, X, Package, User } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { LineItemEditor } from './LineItemEditor'
import { useLinePriceMeta } from './useLinePriceMeta'
import { useBogoPermission } from '../useBogoPermission'
import { PartySearchInput } from './PartySearchInput'
import { ProductSearchInput } from './ProductSearchInput'
import { FrequentProductChips } from './FrequentProductChips'
import { InvoiceScanButton } from './InvoiceScanButton'
import { TaxPickerColumn } from './TaxPickerColumn'
import { HsnTypeahead } from './HsnTypeahead'
import { InvoiceItemsEmptyState } from './InvoiceItemsEmptyState'
import { InvoiceStockWarnings } from './InvoiceStockWarnings'
import { calculateLineTotal } from '../invoice-calc.utils'
import { calculateLineProfit } from '../invoice-totals.utils'
import { usePartyTier } from '@/features/price-lists/use-party-tier'
import { usePriceListOverride } from '@/features/pricing/usePriceListOverride'
import { PriceListOverrideSelector } from '@/features/pricing/components/PriceListOverrideSelector'
import type { LineItemFormData, ProductPick } from '../invoice.types'
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
  isEditMode?: boolean
  priceListId?: string | null
  onPriceListChange?: (id: string | null) => void
  onPartyChange: (id: string, name: string) => void
  onProductSelect: (pick: ProductPick) => void
  onUpdateLineItem: (index: number, item: Partial<LineItemFormData>) => void
  onRemoveLineItem: (index: number) => void
  onToggleProductSearch: () => void
}

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
    (pick: ProductPick) => {
      appendMeta(pick.salePrice)
      onProductSelect(pick)
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
  const addedQuantities = Object.fromEntries(lineItems.map((item) => [item.productId, item.quantity]))

  return (
    <div className="line-items-section py-0 space-y-6">
      {/* ── 1. Customer Section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
            <User size={14} className="text-[#026F39]" />
            <span>{t.customer || 'CUSTOMER'}</span>
            <span className="text-red-500">*</span>
          </label>
        </div>

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
      </div>

      {/* ── 2. Items Section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Package size={14} className="text-[#026F39]" />
            <span>{t.sectionItems || 'ITEMS'}</span>
          </label>
          <Button
            variant="none"
            type="button"
            className="text-[#026F39] hover:text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            onClick={onToggleProductSearch}
            aria-label={showProductSearch ? t.hideProductSearch : t.addLineItemLabel}
            aria-expanded={showProductSearch}
          >
            {showProductSearch ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            <span>{showProductSearch ? t.hideSearch : `+ ${t.addItem || 'Add Item'}`}</span>
          </Button>
        </div>

        {showProductSearch && (
          <div className="product-search-panel py-0">
            <ProductSearchInput onSelect={handleProductSelect} addedProductIds={addedProductIds} autoFocus />
          </div>
        )}

        {lineItems.length === 0 && !showProductSearch && (
          <InvoiceItemsEmptyState
            emptyTitle={t.noItemsAdded || 'No items added yet'}
            emptySub="Add products or services to this invoice"
            addItemLabel={t.addItem || 'Add Item'}
            onToggleProductSearch={onToggleProductSearch}
            onProductSelect={handleProductSelect}
          />
        )}

        {lineItems.map((item, index) => {
          const { lineTotal, discountAmount } = calculateLineTotal(
            item.quantity, item.rate, item.discountType, item.discountValue,
          )
          const { profit, profitPercent } = calculateLineProfit(item.rate, 0, item.quantity, discountAmount)
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

        <InvoiceStockWarnings
          stockWarnings={stockWarnings}
          hasStockBlocks={hasStockBlocks}
          insufficientStockLabel={t.insufficientStock}
          lowStockWarningLabel={t.lowStockWarning}
          availableLabel={t.availableLabel}
          requestedLabel={t.requestedLabel}
        />

        {errors.stock && <span className="field-error" role="alert">{errors.stock}</span>}

        {partyId && (
          <FrequentProductChips
            partyId={partyId}
            quantities={addedQuantities}
            onAdd={handleProductSelect}
          />
        )}

        {lineItems.length > 0 && (
          <div className="invoice-scan-row">
            <InvoiceScanButton onAdd={handleProductSelect} />
          </div>
        )}
      </div>
    </div>
  )
}
