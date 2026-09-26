/** Edit Payment — Page (lazy loaded)
 *
 * Fetches existing payment data, pre-populates the form via
 * usePaymentForm({ payment: PaymentDetail }), then composes
 * shared section components inside FormPageShell.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FormPageShell } from '@/components/layout/FormPageShell'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { usePaymentForm } from './usePaymentForm'
import { getPayment } from './payment.service'
import { PaymentFormSections } from './components/PaymentFormSections'
import { usePresence } from '@/features/collaboration/usePresence'
import { PresenceAvatars } from '@/features/collaboration/PresenceAvatars'
import { ConflictDialog } from '@/features/collaboration/ConflictDialog'
import type { PaymentDetail } from './payment.types'
import './payment-form-layout.css'
import './payment-form-details.css'
import './payment-form-actions.css'

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

  if (loadStatus === 'loading' || loadStatus === 'error' || !paymentDetail) {
    return (
      <FormPageShell
        title={t.editPayment}
        backTo={`/payments/${paymentId}`}
        isLoading={loadStatus === 'loading'}
        error={loadStatus === 'error' ? t.couldNotLoadPayment : null}
        onRetry={() => window.location.reload()}
        footer={
          <Button type="button" variant="primary" size="lg" disabled>
            {t.updatePaymentBtn}
          </Button>
        }
      >
        <div />
      </FormPageShell>
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
    form, errors, isSubmitting,
    updateField, updateMode, toggleAllocation, updateAllocationAmount,
    autoAllocate, toggleDiscount, updateDiscount, handleSubmit, conflictReconcile,
  } = usePaymentForm({ payment })
  const { peers } = usePresence('payment', paymentId, 'editing')

  return (
    <FormPageShell
      title={t.editPayment}
      backTo={`/payments/${paymentId}`}
      actions={<PresenceAvatars peers={peers} />}
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      footer={
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="payment-save-btn"
          onClick={handleSubmit}
          loading={isSubmitting}
          aria-label={isSubmitting ? t.updatingPayment : t.updatePaymentLabel}
        >
          {isSubmitting ? t.processing : t.updatePaymentBtn}
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

      <ConflictDialog
        conflict={conflictReconcile.conflict}
        overwriting={conflictReconcile.overwriting}
        onReload={conflictReconcile.reload}
        onOverwrite={conflictReconcile.overwrite}
        onDismiss={conflictReconcile.dismiss}
      />
    </FormPageShell>
  )
}
