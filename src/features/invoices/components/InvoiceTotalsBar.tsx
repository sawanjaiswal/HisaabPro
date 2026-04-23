/** Create Invoice — sticky bottom totals + save actions */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
  const isProfitPositive = totalProfit >= 0
  const profitClass = isProfitPositive
    ? 'invoice-summary-profit invoice-summary-profit-positive'
    : 'invoice-summary-profit invoice-summary-profit-negative'

  return (
    <div className="invoice-summary-bar" aria-label={t.invoiceTotalsAriaLabel}>
      <div className="invoice-summary-rows" role="list">
        <div className="invoice-summary-row" role="listitem">
          <span>{t.subtotal}</span>
          <span>{formatInvoiceAmount(subtotal)}</span>
        </div>

        {totalDiscount > 0 && (
          <div className="invoice-summary-row" role="listitem">
            <span>{t.discount}</span>
            <span className="text-error">
              -{formatInvoiceAmount(totalDiscount)}
            </span>
          </div>
        )}

        {totalCharges > 0 && (
          <div className="invoice-summary-row" role="listitem">
            <span>{t.chargesLabel}</span>
            <span>+{formatInvoiceAmount(totalCharges)}</span>
          </div>
        )}

        {roundOff !== 0 && (
          <div className="invoice-summary-row" role="listitem">
            <span>{t.roundOff}</span>
            <span className={roundOff < 0 ? 'text-error' : ''}>
              {roundOff > 0 ? '+' : ''}{formatInvoiceAmount(Math.abs(roundOff))}
            </span>
          </div>
        )}

        <div className="invoice-summary-row invoice-summary-row-total" role="listitem">
          <span>{t.grandTotal}</span>
          <span>{formatInvoiceAmount(grandTotal)}</span>
        </div>
      </div>

      {showProfit && (
        <p className={profitClass} aria-label={`${t.profitLabel} ${formatInvoiceAmount(totalProfit)}, ${profitPercent.toFixed(1)}%`}>
          {t.profitLabel} {isProfitPositive ? '+' : ''}{formatInvoiceAmount(totalProfit)}
          {' '}({profitPercent.toFixed(1)}%)
        </p>
      )}

      <div className="invoice-summary-actions">
        <button
          type="button"
          className="btn btn-secondary btn-md"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          aria-label={t.saveDraftAriaLabel}
        >
          {t.saveDraft}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={onSave}
          disabled={isSubmitting}
          aria-label={isSubmitting ? t.savingInvoice : t.saveInvoice}
        >
          {isSubmitting ? t.saving : t.save}
        </button>
      </div>
    </div>
  )
}
