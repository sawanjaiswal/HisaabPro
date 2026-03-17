/** Payment Details Section — shared between Record & Edit pages
 *
 * Party, Amount, Date, Payment Mode, Reference Number, Notes.
 * Receives all data + handlers via props — no internal state.
 */

import { PartySearchInput } from '@/components/ui/PartySearch'
import { PAYMENT_MODE_LABELS, MODES_WITH_REFERENCE } from '../payment.constants'
import { getReferencePlaceholder } from '../payment.utils'
import type { PaymentMode } from '../payment.types'

const PAYMENT_MODES: PaymentMode[] = [
  'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT_RTGS_IMPS', 'CREDIT_CARD', 'OTHER',
]

interface PaymentDetailsSectionProps {
  partyId: string
  amount: number
  date: string
  mode: PaymentMode
  referenceNumber: string
  notes: string
  errors: Record<string, string>
  onPartyChange: (id: string) => void
  onAmountChange: (paise: number) => void
  onDateChange: (date: string) => void
  onModeChange: (mode: PaymentMode) => void
  onReferenceChange: (ref: string) => void
  onNotesChange: (notes: string) => void
}

export function PaymentDetailsSection({
  partyId,
  amount,
  date,
  mode,
  referenceNumber,
  notes,
  errors,
  onPartyChange,
  onAmountChange,
  onDateChange,
  onModeChange,
  onReferenceChange,
  onNotesChange,
}: PaymentDetailsSectionProps) {
  const showReference = MODES_WITH_REFERENCE.includes(mode)

  return (
    <div className="payment-form">
      {/* Party */}
      <PartySearchInput
        value={partyId}
        onChange={onPartyChange}
        error={errors.partyId}
      />

      {/* Amount */}
      <div className="payment-field">
        <label className="label" htmlFor="payment-amount">Amount *</label>
        <div className="payment-amount-field">
          <span className="payment-amount-prefix" aria-hidden="true">₹</span>
          <input
            id="payment-amount"
            type="number"
            inputMode="decimal"
            className="input payment-amount-input"
            placeholder="0.00"
            value={amount > 0 ? (amount / 100).toFixed(2) : ''}
            onChange={(e) => {
              const paise = Math.round(parseFloat(e.target.value || '0') * 100)
              onAmountChange(paise)
            }}
            aria-label="Payment amount in rupees"
          />
        </div>
        {errors.amount && <span className="field-error" role="alert">{errors.amount}</span>}
      </div>

      {/* Date */}
      <div className="payment-row">
        <div className="payment-field payment-field-half">
          <label className="label" htmlFor="payment-date">Date *</label>
          <input
            id="payment-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label="Payment date"
          />
          {errors.date && <span className="field-error" role="alert">{errors.date}</span>}
        </div>
      </div>

      {/* Payment Mode Grid */}
      <div className="payment-field">
        <label className="label">Payment Mode *</label>
        <div className="payment-mode-grid" role="radiogroup" aria-label="Payment mode">
          {PAYMENT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`payment-mode-item${mode === m ? ' active' : ''}`}
              onClick={() => onModeChange(m)}
              role="radio"
              aria-checked={mode === m}
              aria-label={PAYMENT_MODE_LABELS[m]}
            >
              {PAYMENT_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        {errors.mode && <span className="field-error" role="alert">{errors.mode}</span>}
      </div>

      {/* Reference Number (conditional) */}
      {showReference && (
        <div className="payment-field">
          <label className="label" htmlFor="payment-ref">Reference Number</label>
          <input
            id="payment-ref"
            type="text"
            className="input"
            placeholder={getReferencePlaceholder(mode)}
            value={referenceNumber}
            onChange={(e) => onReferenceChange(e.target.value)}
            aria-label="Reference number"
            maxLength={100}
          />
          {errors.referenceNumber && <span className="field-error" role="alert">{errors.referenceNumber}</span>}
        </div>
      )}

      {/* Notes */}
      <div className="payment-field">
        <label className="label" htmlFor="payment-notes">Notes</label>
        <textarea
          id="payment-notes"
          className="input"
          rows={3}
          placeholder="Add a note..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          aria-label="Payment notes"
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? 'payment-notes-error' : undefined}
          maxLength={500}
        />
        {errors.notes && <span id="payment-notes-error" className="field-error" role="alert">{errors.notes}</span>}
      </div>
    </div>
  )
}
