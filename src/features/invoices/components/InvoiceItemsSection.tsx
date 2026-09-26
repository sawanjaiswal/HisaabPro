import { useCallback } from 'react'
import { Plus, X, AlertTriangle, Package, User, Sparkles } from 'lucide-react'
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
  /** #132 Batch 6 — when true, existing lines start as EDITED so rates are not auto-replaced. */
  isEditMode?: boolean
  /** Epic B PR2 — current price-list override id from form state (null = party default) */
  priceListId?: string | null
  /** Epic B PR2 — called when user changes the tier override */
  onPriceListChange?: (id: string | null) => void
  onPartyChange: (id: string, name: string) => void
  onProductSelect: (pick: ProductPick) => void
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
    <div className="line-items-section py-0 space-y-4">
      {/* ── 1. Customer Card ── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <User size={15} className="text-emerald-700" />
            <span>{t.customer || 'Customer'}</span>
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

      {/* ── 2. Items Card ── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <Package size={15} className="text-emerald-700" />
            <span>{t.sectionItems || 'Items'}</span>
          </label>
          <Button
            variant="none"
            type="button"
            className="text-emerald-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
          <div className="bg-[var(--color-gray-50)]/40 border-2 border-dashed border-[var(--color-border)] rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-2">
            <div className="relative inline-flex items-center justify-center p-3.5 bg-emerald-50 rounded-2xl text-emerald-700 mb-1">
              <Package size={34} strokeWidth={1.5} />
              <Sparkles size={16} className="absolute -top-1 -right-1 text-emerald-500" />
            </div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              {t.noItemsAdded || 'No items added yet'}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs">
              Add products or services to this invoice
            </p>
            <div className="flex items-center gap-2.5 pt-3">
              <Button
                variant="none"
                type="button"
                className="bg-[#026F39] hover:bg-[#025a2e] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                onClick={onToggleProductSearch}
              >
                <Plus size={14} />
                <span>+ {t.addItem || 'Add Item'}</span>
              </Button>
              <div className="[&>button]:bg-emerald-50 [&>button]:text-emerald-800 [&>button]:border [&>button]:border-emerald-200/80 [&>button]:hover:bg-emerald-100 [&>button]:font-bold [&>button]:text-xs [&>button]:px-4 [&>button]:py-2.5 [&>button]:rounded-xl">
                <InvoiceScanButton onAdd={handleProductSelect} />
              </div>
            </div>
          </div>
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
