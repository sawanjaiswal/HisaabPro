/** Record Payment — Page (lazy loaded)
 *
 * Single form with pill tabs: Details, Invoices, Discount.
 * Sticky bottom save button. Composes shared section components.
 */

import { useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { usePaymentForm } from './usePaymentForm'
import { PAYMENT_FORM_SECTION_LABELS } from './payment.constants'
import { calculateSettlement, calculateUnallocatedAmount } from './payment.utils'
import { PaymentDetailsSection } from './components/PaymentDetailsSection'
import { PaymentInvoicesSection } from './components/PaymentInvoicesSection'
import { PaymentDiscountSection } from './components/PaymentDiscountSection'
import type { PaymentFormSection, PaymentType } from './payment.types'
import './payment-form-layout.css'
import './payment-form-details.css'
import './payment-form-actions.css'

const SECTIONS: { id: PaymentFormSection; label: string }[] = [
  { id: 'details', label: PAYMENT_FORM_SECTION_LABELS.details },
  { id: 'invoices', label: PAYMENT_FORM_SECTION_LABELS.invoices },
  { id: 'discount', label: PAYMENT_FORM_SECTION_LABELS.discount },
]

export default function RecordPaymentPage() {
  const [searchParams] = useSearchParams()
  const typeParam = (searchParams.get('type') ?? 'PAYMENT_IN') as PaymentType

  const {
    form, errors, isSubmitting, activeSection, setActiveSection,
    updateField, updateMode, toggleAllocation, updateAllocationAmount,
    autoAllocate, toggleDiscount, updateDiscount, handleSubmit,
  } = usePaymentForm({ defaultType: typeParam })

  const title = form.type === 'PAYMENT_IN' ? 'Record Payment In' : 'Record Payment Out'
  const settlement = calculateSettlement(form.amount, form.discount)
  const unallocated = calculateUnallocatedAmount(form.amount, form.allocations.filter((a) => a.selected))

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.PAYMENTS} />

      <PageContainer>
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
          {activeSection === 'details' && (
            <PaymentDetailsSection
              partyId={form.partyId}
              amount={form.amount}
              date={form.date}
              mode={form.mode}
              referenceNumber={form.referenceNumber}
              notes={form.notes}
              errors={errors}
              onPartyChange={(id) => updateField('partyId', id)}
              onAmountChange={(paise) => updateField('amount', paise)}
              onDateChange={(d) => updateField('date', d)}
              onModeChange={updateMode}
              onReferenceChange={(ref) => updateField('referenceNumber', ref)}
              onNotesChange={(n) => updateField('notes', n)}
            />
          )}

          {activeSection === 'invoices' && (
            <PaymentInvoicesSection
              allocations={form.allocations}
              unallocatedAmount={unallocated}
              errors={errors}
              onToggle={toggleAllocation}
              onAmountChange={updateAllocationAmount}
              onAutoAllocate={autoAllocate}
            />
          )}

          {activeSection === 'discount' && (
            <PaymentDiscountSection
              discount={form.discount}
              amount={form.amount}
              settlement={settlement}
              errors={errors}
              onToggle={toggleDiscount}
              onUpdate={updateDiscount}
            />
          )}
        </div>
      </PageContainer>

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
