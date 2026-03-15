/** Record Payment — Page (lazy loaded)
 *
 * Single scrollable form: Party → Amount → Date + Mode → Reference → Notes
 * Expandable: Link to Invoices, Apply Discount
 * Sticky bottom save button.
 * Follows CreateInvoicePage.tsx pattern with pill tabs for sections.
 */

import { useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { PartySearchInput } from '@/features/invoices/components/PartySearchInput'
import { usePaymentForm } from './usePaymentForm'
import { PAYMENT_FORM_SECTION_LABELS, PAYMENT_MODE_LABELS, MODES_WITH_REFERENCE, PAYMENT_DISCOUNT_TYPE_LABELS } from './payment.constants'
import { getReferencePlaceholder, calculateSettlement, calculateUnallocatedAmount } from './payment.utils'
import type { PaymentFormSection, PaymentType, PaymentMode, PaymentDiscountType } from './payment.types'
import './payment-form.css'

const SECTIONS: { id: PaymentFormSection; label: string }[] = [
  { id: 'details', label: PAYMENT_FORM_SECTION_LABELS.details },
  { id: 'invoices', label: PAYMENT_FORM_SECTION_LABELS.invoices },
  { id: 'discount', label: PAYMENT_FORM_SECTION_LABELS.discount },
]

const PAYMENT_MODES: PaymentMode[] = [
  'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT_RTGS_IMPS', 'CREDIT_CARD', 'OTHER',
]

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

export default function RecordPaymentPage() {
  const [searchParams] = useSearchParams()
  const typeParam = (searchParams.get('type') ?? 'PAYMENT_IN') as PaymentType

  const {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    updateField,
    updateMode,
    toggleAllocation,
    updateAllocationAmount,
    autoAllocate,
    toggleDiscount,
    updateDiscount,
    handleSubmit,
  } = usePaymentForm({ defaultType: typeParam })

  const title = form.type === 'PAYMENT_IN' ? 'Record Payment In' : 'Record Payment Out'
  const showReference = MODES_WITH_REFERENCE.includes(form.mode)
  const settlement = calculateSettlement(form.amount, form.discount)
  const unallocated = calculateUnallocatedAmount(form.amount, form.allocations.filter((a) => a.selected))

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.PAYMENTS} />

      <PageContainer>
        {/* ── Pill tabs ────────────────────────────────────── */}
        <nav className="pill-tabs" role="tablist" aria-label="Payment form sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              className={`pill-tab${activeSection === section.id ? ' active' : ''}`}
              onClick={() => setActiveSection(section.id)}
              aria-selected={activeSection === section.id}
              aria-controls={`section-panel-${section.id}`}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div
          id={`section-panel-${activeSection}`}
          role="tabpanel"
          aria-label={SECTIONS.find((s) => s.id === activeSection)?.label}
        >
          {/* ── Details Section ──────────────────────────── */}
          {activeSection === 'details' && (
            <div className="payment-form">
              {/* Party */}
              <PartySearchInput
                value={form.partyId}
                onChange={(id) => updateField('partyId', id)}
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
                    value={form.amount > 0 ? (form.amount / 100).toFixed(2) : ''}
                    onChange={(e) => {
                      const paise = Math.round(parseFloat(e.target.value || '0') * 100)
                      updateField('amount', paise)
                    }}
                    aria-label="Payment amount in rupees"
                  />
                </div>
                {errors.amount && <span className="field-error" role="alert">{errors.amount}</span>}
              </div>

              {/* Date + Mode row */}
              <div className="payment-row">
                <div className="payment-field payment-field-half">
                  <label className="label" htmlFor="payment-date">Date *</label>
                  <input
                    id="payment-date"
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    aria-label="Payment date"
                  />
                  {errors.date && <span className="field-error" role="alert">{errors.date}</span>}
                </div>
              </div>

              {/* Payment Mode Grid */}
              <div className="payment-field">
                <label className="label">Payment Mode *</label>
                <div className="payment-mode-grid" role="radiogroup" aria-label="Payment mode">
                  {PAYMENT_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`payment-mode-item${form.mode === mode ? ' active' : ''}`}
                      onClick={() => updateMode(mode)}
                      role="radio"
                      aria-checked={form.mode === mode}
                      aria-label={PAYMENT_MODE_LABELS[mode]}
                    >
                      {PAYMENT_MODE_LABELS[mode]}
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
                    placeholder={getReferencePlaceholder(form.mode)}
                    value={form.referenceNumber}
                    onChange={(e) => updateField('referenceNumber', e.target.value)}
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
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  aria-label="Payment notes"
                  maxLength={500}
                />
                {errors.notes && <span className="field-error" role="alert">{errors.notes}</span>}
              </div>
            </div>
          )}

          {/* ── Link Invoices Section ────────────────────── */}
          {activeSection === 'invoices' && (
            <div className="payment-form">
              {form.allocations.length === 0 && (
                <p className="payment-empty-text">
                  No unpaid invoices for this party. This payment will be recorded as advance.
                </p>
              )}

              {form.allocations.length > 0 && (
                <>
                  <div className="payment-invoices-header">
                    <span className="payment-invoices-count">
                      {form.allocations.filter((a) => a.selected).length} of {form.allocations.length} invoices selected
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={autoAllocate}
                      aria-label="Auto-allocate oldest first"
                    >
                      Auto (FIFO)
                    </button>
                  </div>

                  <div className="payment-invoices-list">
                    {form.allocations.map((alloc) => (
                      <div key={alloc.invoiceId} className="payment-invoice-row">
                        <label className="payment-invoice-check">
                          <input
                            type="checkbox"
                            checked={alloc.selected}
                            onChange={() => toggleAllocation(alloc.invoiceId)}
                            aria-label={`Link ${alloc.invoiceNumber}`}
                          />
                          <div className="payment-invoice-info">
                            <span className="payment-invoice-number">{alloc.invoiceNumber}</span>
                            <span className="payment-invoice-due">Due: {formatAmount(alloc.invoiceDue)}</span>
                          </div>
                        </label>
                        {alloc.selected && (
                          <input
                            type="number"
                            inputMode="decimal"
                            className="input payment-alloc-amount"
                            placeholder="0.00"
                            value={alloc.amount > 0 ? (alloc.amount / 100).toFixed(2) : ''}
                            onChange={(e) => {
                              const paise = Math.round(parseFloat(e.target.value || '0') * 100)
                              updateAllocationAmount(alloc.invoiceId, paise)
                            }}
                            aria-label={`Amount for ${alloc.invoiceNumber}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {errors.allocations && <span className="field-error" role="alert">{errors.allocations}</span>}

                  <div className="payment-unallocated">
                    {unallocated > 0
                      ? `${formatAmount(unallocated)} will be recorded as advance payment`
                      : 'Fully allocated'}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Discount Section ──────────────────────────── */}
          {activeSection === 'discount' && (
            <div className="payment-form">
              <label className="payment-discount-toggle">
                <input
                  type="checkbox"
                  checked={form.discount !== null}
                  onChange={toggleDiscount}
                  aria-label="Apply discount"
                />
                Apply Discount
              </label>

              {form.discount !== null && (
                <div className="payment-discount-fields">
                  {/* Discount type */}
                  <div className="payment-field">
                    <label className="label">Discount Type</label>
                    <div className="payment-discount-type" role="radiogroup" aria-label="Discount type">
                      {(['PERCENTAGE', 'FIXED'] as PaymentDiscountType[]).map((type) => (
                        <label key={type} className="payment-radio-label">
                          <input
                            type="radio"
                            name="discountType"
                            value={type}
                            checked={form.discount?.type === type}
                            onChange={() => updateDiscount('type', type)}
                            aria-label={PAYMENT_DISCOUNT_TYPE_LABELS[type]}
                          />
                          {PAYMENT_DISCOUNT_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Discount value */}
                  <div className="payment-field">
                    <label className="label" htmlFor="discount-value">
                      {form.discount.type === 'PERCENTAGE' ? 'Percentage' : 'Amount (₹)'}
                    </label>
                    <input
                      id="discount-value"
                      type="number"
                      inputMode="decimal"
                      className="input"
                      placeholder={form.discount.type === 'PERCENTAGE' ? '0' : '0.00'}
                      value={form.discount.value > 0 ? form.discount.value : ''}
                      onChange={(e) => updateDiscount('value', parseFloat(e.target.value || '0'))}
                      aria-label="Discount value"
                    />
                    {errors['discount.value'] && (
                      <span className="field-error" role="alert">{errors['discount.value']}</span>
                    )}
                  </div>

                  {/* Calculated discount */}
                  {form.discount.calculatedAmount > 0 && (
                    <p className="payment-discount-calc">
                      Discount: {formatAmount(form.discount.calculatedAmount)}
                    </p>
                  )}

                  {/* Reason */}
                  <div className="payment-field">
                    <label className="label" htmlFor="discount-reason">Reason (optional)</label>
                    <input
                      id="discount-reason"
                      type="text"
                      className="input"
                      placeholder="Early payment, long-term customer..."
                      value={form.discount.reason}
                      onChange={(e) => updateDiscount('reason', e.target.value)}
                      aria-label="Discount reason"
                      maxLength={200}
                    />
                    {errors['discount.reason'] && (
                      <span className="field-error" role="alert">{errors['discount.reason']}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Settlement summary */}
              {form.amount > 0 && (
                <div className="payment-settlement-summary">
                  <div className="payment-settlement-row">
                    <span>Payment</span>
                    <span>{formatAmount(settlement.payment)}</span>
                  </div>
                  {settlement.discount > 0 && (
                    <div className="payment-settlement-row">
                      <span>Discount</span>
                      <span>{formatAmount(settlement.discount)}</span>
                    </div>
                  )}
                  <div className="payment-settlement-row payment-settlement-total">
                    <span>Total Settled</span>
                    <span>{formatAmount(settlement.totalSettled)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>

      {/* Sticky save bar */}
      <div className="payment-save-bar">
        <button
          type="button"
          className="btn btn-primary btn-lg payment-save-btn"
          onClick={handleSubmit}
          disabled={isSubmitting}
          aria-label={isSubmitting ? 'Saving payment...' : 'Save payment'}
        >
          {isSubmitting ? 'Saving...' : 'Save Payment'}
        </button>
      </div>
    </AppShell>
  )
}
