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
import { Checkbox } from '@/components/ui/Checkbox'

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
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]" htmlFor="invoice-date">
            {t.invoiceDateLabel || 'INVOICE DATE'}
          </label>
          <DateField
            id="invoice-date"
            type="date"
            className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--color-text-primary)] min-h-[44px] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
            value={documentDate}
            onChange={(e) => onUpdateField('documentDate', e.target.value)}
            aria-label={t.invoiceDateAriaLabel}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t.paymentTermsLabel || 'PAYMENT TERMS'}
        </label>
        <PaymentTermsSelector
          value={paymentTerms ?? 'COD'}
          onChange={(terms: PaymentTerms) => onUpdateField('paymentTerms', terms)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]" htmlFor="invoice-vehicle">
          {t.vehicleNumberLabel || 'VEHICLE NUMBER'}
        </label>
        <Input
          id="invoice-vehicle"
          type="text"
          className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--color-text-primary)] min-h-[44px] uppercase focus:bg-[var(--color-surface)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
          placeholder="MH 12 AB 1234"
          value={vehicleNumber}
          onChange={(e) => onUpdateField('vehicleNumber', e.target.value.toUpperCase())}
          aria-label={t.vehicleNumberLabel}
          maxLength={15}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]" htmlFor="invoice-notes">
          {t.notesLabel || 'NOTES'}
        </label>
        <Textarea
          id="invoice-notes"
          className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-xl p-3 text-sm font-medium text-[var(--color-text-primary)] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)] min-h-[72px] resize-none"
          rows={2}
          placeholder={t.addNoteForCustomer || 'Add a note for your customer...'}
          value={notes}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          aria-label={t.invoiceNotesAriaLabel}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]" htmlFor="invoice-terms">
          {t.termsConditionsLabel || 'TERMS & CONDITIONS'}
        </label>
        <Textarea
          id="invoice-terms"
          className="w-full bg-[var(--color-gray-50)] border border-[var(--color-gray-200)] rounded-xl p-3 text-sm font-medium text-[var(--color-text-primary)] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)] min-h-[72px] resize-none"
          rows={2}
          placeholder={t.paymentTermsReturnPolicy || 'Payment terms, return policy...'}
          value={termsAndConditions}
          onChange={(e) => onUpdateField('termsAndConditions', e.target.value)}
          aria-label={t.termsConditionsAriaLabel}
        />
      </div>

      <label className="flex items-center gap-3 p-3 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface)] transition-colors select-none">
        <Checkbox
          checked={includeSignature}
          onCheckedChange={(checked) => onUpdateField('includeSignature', Boolean(checked))}
          aria-label={t.includeDigitalSignatureAriaLabel}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
            {t.includeDigitalSignature || 'Digital Signature'}
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)] font-normal leading-tight mt-0.5">
            Attach business stamp & authorized signature on invoice
          </span>
        </div>
      </label>
    </div>
  )
}
