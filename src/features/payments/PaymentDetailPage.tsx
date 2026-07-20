/** Payment Details — Page (lazy loaded), mockup #42.
 *
 * Single scroll: identity card → info rows → linked invoices → receipt
 * actions. 4 UI states.
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePaymentDetail } from './usePaymentDetail'
import { PaymentDetailSkeleton } from './components/PaymentDetailSkeleton'
import { PaymentDetailHero } from './components/PaymentDetailHero'
import { PaymentDetailRows } from './components/PaymentDetailRows'
import { PaymentAllocationsSection } from './components/PaymentAllocationsSection'
import { VoucherShareBar } from './voucher/VoucherShareBar'
import './payment-detail.css'
import { Button } from '@/components/ui/Button'

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const paymentId = id ?? ''
  const { payment, status, refresh, handleDelete } = usePaymentDetail(paymentId)

  const [deleteOpen, setDeleteOpen] = useState(false)

  const confirmDelete = () => {
    setDeleteOpen(false)
    handleDelete()
  }

  const headerActions = payment ? (
    <>
      <Button
        variant="ghost" size="sm"
        onClick={() => navigate(ROUTES.PAYMENT_EDIT.replace(':id', paymentId))}
        aria-label={t.editPayment}
      >
        <Pencil size={18} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} aria-label={t.deletePayment}>
        <Trash2 size={18} aria-hidden="true" />
      </Button>
    </>
  ) : null

  return (
    <>
      <AppShell>
        <Header title={t.paymentDetail} backTo={ROUTES.PAYMENTS} actions={headerActions} />

      <PageContainer variant="detail" className="space-y-6">
        {/* Loading */}
        {status === 'loading' && <PaymentDetailSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadPayment}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {/* Not found */}
        {status === 'success' && !payment && (
          <EmptyState
            icon={<Banknote size={40} aria-hidden="true" />}
            title={t.paymentNotFound}
            description={t.paymentNotFoundDesc}
            action={
              <Button
                variant="primary" size="md"
                onClick={() => navigate(ROUTES.PAYMENTS)}
                aria-label={t.goBackToPayments}
              >
                {t.backToPayments}
              </Button>
            }
          />
        )}

        {/* Success */}
        {status === 'success' && payment && (
          <div className="stagger-enter space-y-6">
            <div role="status" aria-live="polite" className="sr-only">
              {t.paymentDetailsLoaded}
            </div>

            <PaymentDetailHero
              type={payment.type}
              partyName={payment.partyName}
              amount={payment.amount}
              mode={payment.mode}
            />

            <PaymentDetailRows
              type={payment.type}
              date={payment.date}
              mode={payment.mode}
              referenceNumber={payment.referenceNumber}
              amount={payment.amount}
              discount={payment.discount}
              unallocatedAmount={payment.unallocatedAmount}
              notes={payment.notes}
              allocations={payment.allocations}
            />

            <PaymentAllocationsSection allocations={payment.allocations} />

            {/* Voucher download / print (#90 receipt, #91 payment) */}
            <VoucherShareBar payment={payment} />
          </div>
        )}
      </PageContainer>
      </AppShell>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={t.deletePaymentTitle}
        description={t.deletePaymentDesc}
      />
    </>
  )
}
