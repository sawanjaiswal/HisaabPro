/** Edit Payment — Page (lazy loaded)
 *
 * Fetches existing payment data, pre-populates the form via
 * usePaymentForm({ payment: PaymentDetail }), then composes
 * shared section components.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { usePaymentForm } from './usePaymentForm'
import { getPayment } from './payment.service'
import { PAYMENT_FORM_SECTION_LABELS } from './payment.constants'
import { calculateSettlement, calculateUnallocatedAmount } from './payment.utils'
import { PaymentDetailsSection } from './components/PaymentDetailsSection'
import { PaymentInvoicesSection } from './components/PaymentInvoicesSection'
import { PaymentDiscountSection } from './components/PaymentDiscountSection'
import type { PaymentDetail, PaymentFormSection } from './payment.types'
import './payment-form-layout.css'
import './payment-form-details.css'
import './payment-form-actions.css'

const SECTIONS: { id: PaymentFormSection; label: string }[] = [
  { id: 'details', label: PAYMENT_FORM_SECTION_LABELS.details },
  { id: 'invoices', label: PAYMENT_FORM_SECTION_LABELS.invoices },
  { id: 'discount', label: PAYMENT_FORM_SECTION_LABELS.discount },
]

export default function EditPaymentPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const paymentId = id ?? ''

  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetail | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')

    getPayment(paymentId, controller.signal)
      .then((detail) => {
        setPaymentDetail(detail)
        setLoadStatus('ready')
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoadStatus('error')
      })

    return () => controller.abort()
  }, [paymentId])

  if (loadStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.editPayment} backTo={`/payments/${paymentId}`} />
        <PageContainer>
          <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={5} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (loadStatus === 'error' || !paymentDetail) {
    return (
      <AppShell>
        <Header title={t.editPayment} backTo={`/payments/${paymentId}`} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadPayment}
            message={t.checkConnectionRetry}
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditPaymentForm paymentId={paymentId} payment={paymentDetail} />
}

/** Inner component — only renders when payment data is loaded */
function EditPaymentForm({
  paymentId,
  payment,
}: {
  paymentId: string
  payment: PaymentDetail
}) {
  const { t } = useLanguage()
  const {
    form, errors, isSubmitting, activeSection, setActiveSection,
    updateField, updateMode, toggleAllocation, updateAllocationAmount,
    autoAllocate, toggleDiscount, updateDiscount, handleSubmit,
  } = usePaymentForm({ payment })

  const settlement = calculateSettlement(form.amount, form.discount)
  const unallocated = calculateUnallocatedAmount(form.amount, form.allocations.filter((a) => a.selected))

  return (
    <AppShell>
      <Header title={t.editPayment} backTo={`/payments/${paymentId}`} />

      <PageContainer>
        <nav className="pill-tabs" role="tablist" aria-label={t.paymentFormSections}>
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
          aria-label={isSubmitting ? t.updatingPayment : t.updatePaymentLabel}
        >
          {isSubmitting ? t.processing : t.updatePaymentBtn}
        </button>
      </div>
    </AppShell>
  )
}
