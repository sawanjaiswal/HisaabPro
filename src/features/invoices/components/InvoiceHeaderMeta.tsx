import React from 'react'
import { Calendar, Hash, Sparkles } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { DateField } from '@/components/ui/DateField'
import './invoice-header-meta.css'

interface InvoiceHeaderMetaProps {
  documentDate: string
  onDateChange: (value: string) => void
  /** Present only when editing an already-saved document. */
  documentNumber?: string | null
}

export const InvoiceHeaderMeta: React.FC<InvoiceHeaderMetaProps> = ({
  documentDate,
  onDateChange,
  documentNumber,
}) => {
  const { t } = useLanguage()

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs grid grid-cols-2 gap-3">
      {/* Invoice No. Cell */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          <Hash size={13} className="text-emerald-700" aria-hidden="true" />
          <span>{t.invoiceNoLabel || 'Invoice No.'}</span>
        </label>
        {documentNumber ? (
          <div className="bg-[var(--color-gray-50)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] tabular-nums flex items-center min-h-[42px]">
            {documentNumber}
          </div>
        ) : (
          <div
            className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-800 flex items-center justify-between min-h-[42px]"
            title={t.numberAutoAssignedHint || 'Auto-generated on save'}
          >
            <span>{t.numberAutoAssigned || 'Auto'}</span>
            <Sparkles size={14} className="text-emerald-600" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Invoice Date Cell */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]" htmlFor="invoice-date-top">
          <Calendar size={13} className="text-emerald-700" aria-hidden="true" />
          <span>{t.invoiceDateLabel || 'Invoice Date'}</span>
        </label>
        <DateField
          id="invoice-date-top"
          type="date"
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] shadow-2xs min-h-[42px]"
          value={documentDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label={t.invoiceDateAriaLabel}
        />
      </div>
    </div>
  )
}
