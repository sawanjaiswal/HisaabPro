import React from 'react'
import { ArrowRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount } from '../invoice-format.utils'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { BottomActionBar } from '@/components/ui/BottomActionBar'

interface InvoiceTotalsBarProps {
  subtotal: number
  totalDiscount: number
  totalCharges: number
  /** Document GST in paise — shown as its own row so the seller sees what the
   *  grand total is carrying. 0 when GST is off. */
  totalTax: number
  roundOff: number
  grandTotal: number
  totalProfit: number
  profitPercent: number
  isSubmitting: boolean
  onSave: () => void
  onSaveDraft: () => void
  showProfit: boolean
  /** Mockup #2 ends in Preview, not Save — when set, the primary button opens
   *  the preview and the real save runs from there. */
  onPreview?: () => void
}

export const InvoiceTotalsBar: React.FC<InvoiceTotalsBarProps> = ({
  subtotal: _subtotal,
  totalDiscount: _totalDiscount,
  totalCharges: _totalCharges,
  totalTax: _totalTax,
  roundOff: _roundOff,
  grandTotal,
  totalProfit,
  profitPercent,
  isSubmitting,
  onSave,
  onSaveDraft,
  showProfit,
  onPreview,
}) => {
  const { t } = useLanguage()
  const isProfitPositive = totalProfit >= 0
  const profitClass = isProfitPositive
    ? 'invoice-summary-profit invoice-summary-profit-positive'
    : 'invoice-summary-profit invoice-summary-profit-negative'

  return (
    <BottomActionBar
      className="!bg-[var(--color-surface)] !backdrop-blur-md !rounded-t-2xl !border-t !border-[var(--color-border)] !shadow-[0_-8px_25px_-5px_rgba(0,0,0,0.08)] !px-4 !pt-3 flex-col"
      aria-label={t.invoiceTotalsAriaLabel}
    >
      <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-3">
        {/* Left: Grand Total */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t.grandTotal || 'Grand Total'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-[var(--color-text-primary)] tabular-nums tracking-tight invoice-summary-row-total">
            {formatInvoiceAmount(grandTotal)}
          </span>
        </div>

        {/* Right: Actions (Save Draft + Preview Invoice) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSubmitting}
            aria-label={t.saveDraftAriaLabel}
          >
            {t.saveDraft || 'Save Draft'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onPreview ?? onSave}
            disabled={isSubmitting}
            aria-label={
              onPreview ? (t.previewInvoice || 'Preview Invoice') : isSubmitting ? t.savingInvoice : t.saveInvoice
            }
            className="flex items-center gap-1.5"
          >
            <span>{onPreview ? (t.previewInvoice || 'Preview Invoice') : isSubmitting ? t.saving : t.save}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {showProfit && (
        <Text className={profitClass} aria-label={`${t.profitLabel} ${formatInvoiceAmount(totalProfit)}, ${profitPercent.toFixed(1)}%`}>
          {t.profitLabel} {isProfitPositive ? '+' : ''}{formatInvoiceAmount(totalProfit)}
          {' '}({profitPercent.toFixed(1)}%)
        </Text>
      )}
    </BottomActionBar>
  )
}
