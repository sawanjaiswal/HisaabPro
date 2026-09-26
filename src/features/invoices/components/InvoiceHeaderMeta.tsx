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
    <div className="bg-white rounded-3xl p-5 shadow-xs border-0 grid grid-cols-2 gap-3">
      {/* Invoice No. Cell */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
          <Hash size={13} className="text-[#026F39]" aria-hidden="true" />
          <span>{t.invoiceNoLabel || 'INVOICE NO.'}</span>
        </label>
        {documentNumber ? (
          <div className="bg-[#F8F9FA] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 tabular-nums flex items-center min-h-[42px]">
            {documentNumber}
          </div>
        ) : (
          <div
            className="bg-[#E8F5E9] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#026F39] flex items-center justify-between min-h-[42px]"
            title={t.numberAutoAssignedHint || 'Auto-generated on save'}
          >
            <span>{t.numberAutoAssigned || 'Auto'}</span>
            <Sparkles size={14} className="text-[#026F39]" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Invoice Date Cell */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500" htmlFor="invoice-date-top">
          <Calendar size={13} className="text-[#026F39]" aria-hidden="true" />
          <span>{t.invoiceDateLabel || 'DATE'}</span>
        </label>
        <DateField
          id="invoice-date-top"
          type="date"
          className="w-full bg-[#F8F9FA] border-0 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-900 min-h-[42px] focus:bg-white focus:ring-2 focus:ring-[#026F39]/20"
          value={documentDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label={t.invoiceDateAriaLabel}
        />
      </div>
    </div>
  )
}
