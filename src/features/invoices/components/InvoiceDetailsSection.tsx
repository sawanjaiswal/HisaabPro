/** Invoice Details Section — shared between Create & Edit Invoice pages
 *
 * Renders: date picker, payment terms, notes, T&C, signature toggle.
 */

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
  return (
    <div className="line-items-section">
      <div className="line-item-field">
        <label className="label" htmlFor="invoice-date">Invoice Date</label>
        <input
          id="invoice-date"
          type="date"
          className="input"
          value={documentDate}
          onChange={(e) => onUpdateField('documentDate', e.target.value)}
          aria-label="Invoice date"
          style={{ minHeight: '44px' }}
        />
      </div>

      <div className="line-item-field">
        <label className="label">Payment Terms</label>
        <PaymentTermsSelector
          value={paymentTerms ?? 'COD'}
          onChange={(terms: PaymentTerms) => onUpdateField('paymentTerms', terms)}
        />
      </div>

      <div className="line-item-field">
        <label className="label" htmlFor="invoice-vehicle">Vehicle Number</label>
        <input
          id="invoice-vehicle"
          type="text"
          className="input"
          placeholder="MH 12 AB 1234"
          value={vehicleNumber}
          onChange={(e) => onUpdateField('vehicleNumber', e.target.value.toUpperCase())}
          aria-label="Vehicle number"
          maxLength={15}
          style={{ minHeight: '44px', textTransform: 'uppercase' }}
        />
      </div>

      <div className="line-item-field">
        <label className="label" htmlFor="invoice-notes">Notes</label>
        <textarea
          id="invoice-notes"
          className="input"
          rows={3}
          placeholder="Add a note for your customer..."
          value={notes}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          aria-label="Invoice notes"
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
      </div>

      <div className="line-item-field">
        <label className="label" htmlFor="invoice-terms">Terms &amp; Conditions</label>
        <textarea
          id="invoice-terms"
          className="input"
          rows={3}
          placeholder="Payment terms, return policy..."
          value={termsAndConditions}
          onChange={(e) => onUpdateField('termsAndConditions', e.target.value)}
          aria-label="Terms and conditions"
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
      </div>

      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <input
          type="checkbox"
          checked={includeSignature}
          onChange={(e) => onUpdateField('includeSignature', e.target.checked)}
          aria-label="Include digital signature"
        />
        Include Digital Signature
      </label>
    </div>
  )
}
