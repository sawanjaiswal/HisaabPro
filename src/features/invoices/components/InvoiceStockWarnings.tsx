import { AlertTriangle } from 'lucide-react'
import type { StockValidationItem } from '../invoice.service'

interface InvoiceStockWarningsProps {
  stockWarnings: StockValidationItem[]
  hasStockBlocks: boolean
  insufficientStockLabel: string
  lowStockWarningLabel: string
  availableLabel: string
  requestedLabel: string
}

export function InvoiceStockWarnings({
  stockWarnings,
  hasStockBlocks,
  insufficientStockLabel,
  lowStockWarningLabel,
  availableLabel,
  requestedLabel,
}: InvoiceStockWarningsProps) {
  if (stockWarnings.length === 0) return null

  return (
    <div className={`stock-warnings${hasStockBlocks ? ' stock-warnings--block' : ''}`} role="alert">
      <div className="stock-warnings-title">
        <AlertTriangle size={16} aria-hidden="true" />
        {hasStockBlocks ? insufficientStockLabel : lowStockWarningLabel}
      </div>
      {stockWarnings.map((w) => (
        <div key={w.productId} className="stock-warning-item">
          <span className="stock-warning-name">{w.productName}</span>
          <span className="stock-warning-detail">
            {w.currentStock} {w.requestedUnit} {availableLabel}, {w.requestedQty} {requestedLabel}
          </span>
        </div>
      ))}
    </div>
  )
}
