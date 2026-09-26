import React from 'react'
import { ArrowRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount } from '../invoice-format.utils'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'

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
    <div
      className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] bg-white/95 backdrop-blur-md border-t border-gray-100/80 px-4 py-3.5 shadow-lg"
      aria-label={t.invoiceTotalsAriaLabel}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        {/* Left: Grand Total */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t.grandTotal || 'Grand Total'}
          </span>
          <span className="text-xl font-black text-slate-900 tabular-nums tracking-tight">
            {formatInvoiceAmount(grandTotal)}
          </span>
        </div>

        {/* Right: Actions (Save Draft + Preview Invoice) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="none"
            onClick={onSaveDraft}
            disabled={isSubmitting}
            aria-label={t.saveDraftAriaLabel}
            className="bg-emerald-50 hover:bg-emerald-100 text-[#026F39] font-bold text-xs px-4 py-2.5 rounded-xl border-0 transition-all cursor-pointer"
          >
            {t.saveDraft || 'Save Draft'}
          </Button>

          <Button
            type="button"
            variant="none"
            onClick={onPreview ?? onSave}
            disabled={isSubmitting}
            aria-label={
              onPreview ? (t.previewInvoice || 'Preview Invoice') : isSubmitting ? t.savingInvoice : t.saveInvoice
            }
            className="bg-[#026F39] hover:bg-[#025a2e] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 border-0"
          >
            <span>{onPreview ? (t.previewInvoice || 'Preview Invoice') : isSubmitting ? t.saving : t.save}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {showProfit && (
        <Text className={profitClass} aria-label={`${t.profitLabel} ${formatInvoiceAmount(totalProfit)}, ${profitPercent.toFixed(1)}%`}>
          {t.profitLabel} {isProfitPositive ? '+' : ''}{formatInvoiceAmount(totalProfit)}
          {' '}({profitPercent.toFixed(1)}%)
        </Text>
      )}
    </div>
  )
}
