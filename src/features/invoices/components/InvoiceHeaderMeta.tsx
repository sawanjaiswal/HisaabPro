/** Invoice Header Meta — surfaces the invoice number + date at the top of the
 *  create flow instead of burying them in the Details accordion (gold-standard
 *  P1: "# + date on surface"). The number is server-assigned on save, so we
 *  show an "Auto" chip until then; the date is inline-editable.
 */

import React from 'react'
import { Calendar, Hash } from 'lucide-react'
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
    <div className="invoice-header-meta">
      <div className="invoice-header-meta-cell">
        <span className="invoice-header-meta-label">
          <Hash size={12} aria-hidden="true" />
          {t.invoiceNoLabel}
        </span>
        {documentNumber ? (
          <span className="invoice-header-meta-value">{documentNumber}</span>
        ) : (
          <span className="invoice-header-meta-auto" title={t.numberAutoAssignedHint}>
            {t.numberAutoAssigned}
          </span>
        )}
      </div>

      <div className="invoice-header-meta-cell">
        <label className="invoice-header-meta-label" htmlFor="invoice-date-top">
          <Calendar size={12} aria-hidden="true" />
          {t.invoiceDateLabel}
        </label>
        <DateField
          id="invoice-date-top"
          type="date"
          className="input invoice-header-meta-date"
          value={documentDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label={t.invoiceDateAriaLabel}
        />
      </div>
    </div>
  )
}
