/** Invoice Details Section — shared between Create & Edit Invoice pages
 *
 * Renders: date picker, payment terms, notes, T&C, signature toggle.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { PaymentTermsSelector } from './PaymentTermsSelector'
import type { DocumentFormData, PaymentTerms } from '../invoice.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'

interface InvoiceDetailsSectionProps {
  documentDate: string
  paymentTerms: PaymentTerms | undefined
  vehicleNumber: string
  notes: string
  termsAndConditions: string
  includeSignature: boolean
  /** When the date is surfaced elsewhere (InvoiceHeaderMeta), hide it here to
   *  avoid a duplicate field. Defaults to showing it (edit form still uses it). */
  hideDate?: boolean
  onUpdateField: <K extends keyof DocumentFormData>(
    key: K,
    value: DocumentFormData[K],
  ) => void
}

export function InvoiceDetailsSection({
  documentDate,
  paymentTerms,
  vehicleNumber,
  notes,
  termsAndConditions,
  includeSignature,
  hideDate = false,
  onUpdateField,
}: InvoiceDetailsSectionProps) {
  const { t } = useLanguage()

  return (
    <div className="space-y-4">
      {!hideDate && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invoice-date">
            {t.invoiceDateLabel || 'INVOICE DATE'}
          </label>
          <DateField
            id="invoice-date"
            type="date"
            className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-900 min-h-[44px] focus:bg-white focus:border-[#026F39] focus:ring-2 focus:ring-[#026F39]/20"
            value={documentDate}
            onChange={(e) => onUpdateField('documentDate', e.target.value)}
            aria-label={t.invoiceDateAriaLabel}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t.paymentTermsLabel || 'PAYMENT TERMS'}
        </label>
        <PaymentTermsSelector
          value={paymentTerms ?? 'COD'}
          onChange={(terms: PaymentTerms) => onUpdateField('paymentTerms', terms)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invoice-vehicle">
          {t.vehicleNumberLabel || 'VEHICLE NUMBER'}
        </label>
        <Input
          id="invoice-vehicle"
          type="text"
          className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-900 min-h-[44px] uppercase focus:bg-white focus:border-[#026F39] focus:ring-2 focus:ring-[#026F39]/20"
          placeholder="MH 12 AB 1234"
          value={vehicleNumber}
          onChange={(e) => onUpdateField('vehicleNumber', e.target.value.toUpperCase())}
          aria-label={t.vehicleNumberLabel}
          maxLength={15}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invoice-notes">
          {t.notesLabel || 'NOTES'}
        </label>
        <Textarea
          id="invoice-notes"
          className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-slate-900 focus:bg-white focus:border-[#026F39] focus:ring-2 focus:ring-[#026F39]/20 min-h-[72px] resize-none"
          rows={2}
          placeholder={t.addNoteForCustomer || 'Add a note for your customer...'}
          value={notes}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          aria-label={t.invoiceNotesAriaLabel}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invoice-terms">
          {t.termsConditionsLabel || 'TERMS & CONDITIONS'}
        </label>
        <Textarea
          id="invoice-terms"
          className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-slate-900 focus:bg-white focus:border-[#026F39] focus:ring-2 focus:ring-[#026F39]/20 min-h-[72px] resize-none"
          rows={2}
          placeholder={t.paymentTermsReturnPolicy || 'Payment terms, return policy...'}
          value={termsAndConditions}
          onChange={(e) => onUpdateField('termsAndConditions', e.target.value)}
          aria-label={t.termsConditionsAriaLabel}
        />
      </div>

      <label className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-xl border border-gray-200/80 cursor-pointer hover:bg-gray-100/60 transition-colors select-none">
        <input
          type="checkbox"
          checked={includeSignature}
          onChange={(e) => onUpdateField('includeSignature', e.target.checked)}
          className="w-4 h-4 rounded text-[#026F39] focus:ring-[#026F39] accent-[#026F39] cursor-pointer shrink-0"
          aria-label={t.includeDigitalSignatureAriaLabel}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-slate-900 leading-tight">
            {t.includeDigitalSignature || 'Digital Signature'}
          </span>
          <span className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
            Attach business stamp & authorized signature on invoice
          </span>
        </div>
      </label>
    </div>
  )
}
