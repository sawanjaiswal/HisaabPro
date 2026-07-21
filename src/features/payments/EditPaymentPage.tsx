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
import { PaymentFormSections } from './components/PaymentFormSections'
import { usePresence } from '@/features/collaboration/usePresence'
import { PresenceAvatars } from '@/features/collaboration/PresenceAvatars'
import { ConflictDialog } from '@/features/collaboration/ConflictDialog'
import type { PaymentDetail } from './payment.types'
import './payment-form-layout.css'
import './payment-form-details.css'
import './payment-form-actions.css'
import { Button } from '@/components/ui/Button'
import { BottomActionBar } from '@/components/ui/BottomActionBar'

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
        <PageContainer variant="form" className="space-y-6">
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
        <PageContainer variant="form" className="space-y-6">
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
    form, errors, isSubmitting,
    updateField, updateMode, toggleAllocation, updateAllocationAmount,
    autoAllocate, toggleDiscount, updateDiscount, handleSubmit, conflictReconcile,
  } = usePaymentForm({ payment })
  const { peers } = usePresence('payment', paymentId, 'editing')

  return (
    <AppShell>
      <Header title={t.editPayment} backTo={`/payments/${paymentId}`} actions={<PresenceAvatars peers={peers} />} />

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
          variant="primary" size="lg" className="payment-save-btn"
          onClick={handleSubmit}
          disabled={isSubmitting}
          aria-label={isSubmitting ? t.updatingPayment : t.updatePaymentLabel}
        >
          {isSubmitting ? t.processing : t.updatePaymentBtn}
        </Button>
      </BottomActionBar>

      <ConflictDialog
        conflict={conflictReconcile.conflict}
        overwriting={conflictReconcile.overwriting}
        onReload={conflictReconcile.reload}
        onOverwrite={conflictReconcile.overwrite}
        onDismiss={conflictReconcile.dismiss}
      />
    </AppShell>
  )
}
