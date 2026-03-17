/** Invoice Items Section — shared between Create & Edit Invoice pages
 *
 * Renders: party search, line item editors, stock warnings, product search toggle.
 * All amounts in PAISE.
 */

import { Plus, AlertTriangle } from 'lucide-react'
import { LineItemEditor } from './LineItemEditor'
import { PartySearchInput } from './PartySearchInput'
import { ProductSearchInput } from './ProductSearchInput'
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
  onPartyChange,
  onProductSelect,
  onUpdateLineItem,
  onRemoveLineItem,
  onToggleProductSearch,
}: InvoiceItemsSectionProps) {
  const addedProductIds = lineItems.map((item) => item.productId)

  return (
    <div className="line-items-section">
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
          <LineItemEditor
            key={item.productId}
            item={{
              ...item,
              productName: productNames[item.productId] ?? `Item ${index + 1}`,
              discountAmount,
              lineTotal,
              profit,
              profitPercent,
            }}
            index={index}
            onUpdate={onUpdateLineItem}
            onRemove={onRemoveLineItem}
            showProfit={false}
          />
        )
      })}

      {errors.lineItems && (
        <span className="field-error" role="alert">{errors.lineItems}</span>
      )}

      {stockWarnings.length > 0 && (
        <div className={`stock-warnings${hasStockBlocks ? ' stock-warnings--block' : ''}`} role="alert">
          <div className="stock-warnings-title">
            <AlertTriangle size={16} aria-hidden="true" />
            {hasStockBlocks ? 'Insufficient Stock' : 'Low Stock Warning'}
          </div>
          {stockWarnings.map((w) => (
            <div key={w.productId} className="stock-warning-item">
              <span className="stock-warning-name">{w.productName}</span>
              <span className="stock-warning-detail">
                {w.currentStock} {w.requestedUnit} available, {w.requestedQty} requested
              </span>
            </div>
          ))}
        </div>
      )}

      {errors.stock && (
        <span className="field-error" role="alert">{errors.stock}</span>
      )}

      {showProductSearch && (
        <div className="product-search-panel">
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
        aria-label={showProductSearch ? 'Hide product search' : 'Add line item'}
        aria-expanded={showProductSearch}
      >
        <Plus size={18} aria-hidden="true" />
        {showProductSearch ? 'Hide Search' : 'Add Item'}
      </button>
    </div>
  )
}
