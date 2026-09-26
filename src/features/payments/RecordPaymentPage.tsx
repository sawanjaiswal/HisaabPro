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

  const title = form.type === 'PAYMENT_IN' ? (t.recordPaymentIn || 'Record Payment In') : (t.recordPaymentOut || 'Record Payment Out')

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
          variant="none"
          size="lg"
          className="w-full bg-[#024724] hover:bg-[#01351a] active:scale-[0.99] text-white font-bold py-4 rounded-2xl shadow-md text-base transition-all flex items-center justify-center cursor-pointer"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label={isSubmitting ? t.savingPayment : 'Save Payment'}
        >
          {isSubmitting ? t.saving : 'Save Payment'}
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
