/** Record Payment — Page (lazy loaded)
 *
 * Mockup #7 is one continuous scroll rather than pill tabs; the body lives in
 * <PaymentFormSections> so Edit renders the same thing. Sticky bottom save.
 */

import { useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
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

  const {
    form, errors, isSubmitting,
    updateField, updateMode, toggleAllocation, updateAllocationAmount,
    autoAllocate, toggleDiscount, updateDiscount, handleSubmit,
  } = usePaymentForm({ defaultType: typeParam })

  const title = form.type === 'PAYMENT_IN' ? t.recordPaymentIn : t.recordPaymentOut

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.PAYMENTS} />

      <PageContainer variant="form" className="stagger-enter space-y-6">
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
      </PageContainer>

      <BottomActionBar>
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
      </BottomActionBar>
    </AppShell>
  )
}
