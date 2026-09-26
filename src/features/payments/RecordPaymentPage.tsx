/** Record Payment — Page (lazy loaded)
 *
 * Mockup #7 is one continuous scroll rather than pill tabs; the body lives in
 * <PaymentFormSections> so Edit renders the same thing. Sticky bottom save.
 */

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FormPageShell } from '@/components/layout/FormPageShell'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePaymentForm } from './usePaymentForm'
import { PaymentFormSections } from './components/PaymentFormSections'
import type { PaymentType } from './payment.types'
import './payment-form-layout.css'
import './payment-form-details.css'
import './payment-form-actions.css'

export default function RecordPaymentPage() {
  const [searchParams] = useSearchParams()
  const { t } = useLanguage()
  const typeParam = (searchParams.get('type') ?? 'PAYMENT_IN') as PaymentType
  const partyIdParam = searchParams.get('partyId') ?? ''

  const {
    form, errors, isSubmitting,
    updateField, updateMode, toggleAllocation, updateAllocationAmount,
    autoAllocate, toggleDiscount, updateDiscount, handleSubmit,
  } = usePaymentForm({ defaultType: typeParam, defaultPartyId: partyIdParam })

  useEffect(() => {
    if (partyIdParam && form.partyId !== partyIdParam) {
      updateField('partyId', partyIdParam)
    }
  }, [partyIdParam, form.partyId, updateField])

  const title = form.type === 'PAYMENT_IN' ? t.recordPaymentIn : t.recordPaymentOut

  return (
    <FormPageShell
      title={title}
      backTo={ROUTES.PAYMENTS}
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      footer={
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label={isSubmitting ? t.savingPayment : t.savePayment}
        >
          {isSubmitting ? t.saving : t.savePaymentBtn}
        </Button>
      }
    >
      <PaymentFormSections
        form={form}
        errors={errors}
        updateField={updateField}
        updateMode={updateMode}
        toggleAllocation={toggleAllocation}
        updateAllocationAmount={updateAllocationAmount}
        autoAllocate={autoAllocate}
        toggleDiscount={toggleDiscount}
        updateDiscount={updateDiscount}
      />
    </FormPageShell>
  )
}
