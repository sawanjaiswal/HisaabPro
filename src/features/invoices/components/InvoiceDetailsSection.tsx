/** Invoice Details Section — shared between Create & Edit Invoice pages
 *
 * Renders: date picker, payment terms, notes, T&C, signature toggle.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { PaymentTermsSelector } from './PaymentTermsSelector'
import type { DocumentFormData, PaymentTerms } from '../invoice.types'

interface InvoiceDetailsSectionProps {
  documentDate: string
  paymentTerms: PaymentTerms | undefined
  vehicleNumber: string
  notes: string
  termsAndConditions: string
  includeSignature: boolean
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
  onUpdateField,
}: InvoiceDetailsSectionProps) {
  const { t } = useLanguage()
  return (
    <div className="line-items-section py-0">
      <div className="line-item-field">
        <label className="label" htmlFor="invoice-date">{t.invoiceDateLabel}</label>
        <input
          id="invoice-date"
          type="date"
          className="input"
          value={documentDate}
          onChange={(e) => onUpdateField('documentDate', e.target.value)}
          aria-label={t.invoiceDateAriaLabel}
          style={{ minHeight: '44px' }}
        />
      </div>

      <div className="line-item-field">
        <label className="label">{t.paymentTermsLabel}</label>
        <PaymentTermsSelector
          value={paymentTerms ?? 'COD'}
          onChange={(terms: PaymentTerms) => onUpdateField('paymentTerms', terms)}
        />
      </div>

      <div className="line-item-field">
        <label className="label" htmlFor="invoice-vehicle">{t.vehicleNumberLabel}</label>
        <input
          id="invoice-vehicle"
          type="text"
          className="input"
          placeholder="MH 12 AB 1234"
          value={vehicleNumber}
          onChange={(e) => onUpdateField('vehicleNumber', e.target.value.toUpperCase())}
          aria-label={t.vehicleNumberLabel}
          maxLength={15}
          style={{ minHeight: '44px', textTransform: 'uppercase' }}
        />
      </div>

      <div className="line-item-field">
        <label className="label" htmlFor="invoice-notes">{t.notesLabel}</label>
        <textarea
          id="invoice-notes"
          className="input"
          rows={3}
          placeholder={t.addNoteForCustomer}
          value={notes}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          aria-label={t.invoiceNotesAriaLabel}
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
      </div>

      <div className="line-item-field">
        <label className="label" htmlFor="invoice-terms">{t.termsConditionsLabel}</label>
        <textarea
          id="invoice-terms"
          className="input"
          rows={3}
          placeholder={t.paymentTermsReturnPolicy}
          value={termsAndConditions}
          onChange={(e) => onUpdateField('termsAndConditions', e.target.value)}
          aria-label={t.termsConditionsAriaLabel}
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
      </div>

      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <input
          type="checkbox"
          checked={includeSignature}
          onChange={(e) => onUpdateField('includeSignature', e.target.checked)}
          aria-label={t.includeDigitalSignatureAriaLabel}
        />
        {t.includeDigitalSignature}
      </label>
    </div>
  )
}
