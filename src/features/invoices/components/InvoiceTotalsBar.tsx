/** Create Invoice — sticky bottom totals + save actions */

import React from 'react'
import { formatInvoiceAmount } from '../invoice-format.utils'

interface InvoiceTotalsBarProps {
  subtotal: number
  totalDiscount: number
  totalCharges: number
  roundOff: number
  grandTotal: number
  totalProfit: number
  profitPercent: number
  isSubmitting: boolean
  onSave: () => void
  onSaveDraft: () => void
  showProfit: boolean
}

export const InvoiceTotalsBar: React.FC<InvoiceTotalsBarProps> = ({
  subtotal,
  totalDiscount,
  totalCharges,
  roundOff,
  grandTotal,
  totalProfit,
  profitPercent,
  isSubmitting,
  onSave,
  onSaveDraft,
  showProfit,
}) => {
  const isProfitPositive = totalProfit >= 0
  const profitClass = isProfitPositive
    ? 'invoice-summary-profit invoice-summary-profit-positive'
    : 'invoice-summary-profit invoice-summary-profit-negative'

  return (
    <div className="invoice-summary-bar" aria-label="Invoice totals">
      <div className="invoice-summary-rows" role="list">
        <div className="invoice-summary-row" role="listitem">
          <span>Subtotal</span>
          <span>{formatInvoiceAmount(subtotal)}</span>
        </div>

        {totalDiscount > 0 && (
          <div className="invoice-summary-row" role="listitem">
            <span>Discount</span>
            <span style={{ color: 'var(--color-error-600)' }}>
              -{formatInvoiceAmount(totalDiscount)}
            </span>
          </div>
        )}

        {totalCharges > 0 && (
          <div className="invoice-summary-row" role="listitem">
            <span>Charges</span>
            <span>+{formatInvoiceAmount(totalCharges)}</span>
          </div>
        )}

        {roundOff !== 0 && (
          <div className="invoice-summary-row" role="listitem">
            <span>Round Off</span>
            <span style={{ color: roundOff < 0 ? 'var(--color-error-600)' : 'inherit' }}>
              {roundOff > 0 ? '+' : ''}{formatInvoiceAmount(Math.abs(roundOff))}
            </span>
          </div>
        )}

        <div className="invoice-summary-row invoice-summary-row-total" role="listitem">
          <span>Grand Total</span>
          <span>{formatInvoiceAmount(grandTotal)}</span>
        </div>
      </div>

      {showProfit && (
        <p className={profitClass} aria-label={`Profit: ${formatInvoiceAmount(totalProfit)}, ${profitPercent.toFixed(1)}%`}>
          Profit: {isProfitPositive ? '+' : ''}{formatInvoiceAmount(totalProfit)}
          {' '}({profitPercent.toFixed(1)}%)
        </p>
      )}

      <div className="invoice-summary-actions">
        <button
          type="button"
          className="btn btn-secondary btn-md"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          aria-label="Save as draft"
        >
          Save Draft
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={onSave}
          disabled={isSubmitting}
          aria-label={isSubmitting ? 'Saving invoice...' : 'Save invoice'}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
