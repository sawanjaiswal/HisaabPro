import React from 'react'
import { Calendar, Hash } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { DateField } from '@/components/ui/DateField'
import { Input } from '@/components/ui/Input'
import './invoice-header-meta.css'

interface InvoiceHeaderMetaProps {
  documentNumber?: string | null
  onNumberChange: (value: string) => void
  documentDate: string
  onDateChange: (value: string) => void
}

export const InvoiceHeaderMeta: React.FC<InvoiceHeaderMetaProps> = ({
  documentNumber,
  onNumberChange,
  documentDate,
  onDateChange,
}) => {
  const { t } = useLanguage()

  return (
    <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs">
      {/* Invoice No. Field */}
      <div className="space-y-1.5">
        <label
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]"
          htmlFor="invoice-number-input"
        >
          <Hash size={13} className="text-[var(--color-primary-600)]" aria-hidden="true" />
          <span>{t.invoiceNoLabel || 'INVOICE NO.'}</span>
        </label>
        <Input
          id="invoice-number-input"
          type="text"
          value={documentNumber ?? ''}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="Auto (e.g. INV-001)"
          className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary-500)] rounded-xl px-3 text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] min-h-[42px]"
          aria-label={t.invoiceNoLabel || 'Invoice Number'}
        />
      </div>

      {/* Invoice Date Field */}
      <div className="space-y-1.5">
        <label
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]"
          htmlFor="invoice-date-top"
        >
          <Calendar size={13} className="text-[var(--color-primary-600)]" aria-hidden="true" />
          <span>{t.invoiceDateLabel || 'INVOICE DATE'}</span>
        </label>
        <DateField
          id="invoice-date-top"
          type="date"
          className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary-500)] rounded-xl px-3 text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] min-h-[42px]"
          value={documentDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label={t.invoiceDateAriaLabel}
        />
      </div>
    </div>
  )
}
