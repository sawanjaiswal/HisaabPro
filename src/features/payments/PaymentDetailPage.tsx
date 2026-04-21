/** Payment Detail — Page (lazy loaded)
 *
 * Follows InvoiceDetailPage.tsx pattern: hero header card,
 * pill tabs (Overview / Allocations / History), 4 UI states.
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
import { PAYMENT_DETAIL_TAB_LABELS } from './payment.constants'
import { PaymentDetailSkeleton } from './components/PaymentDetailSkeleton'
import { PaymentDetailHero } from './components/PaymentDetailHero'
import { PaymentOverviewTab } from './components/PaymentOverviewTab'
import { PaymentAllocationsTab } from './components/PaymentAllocationsTab'
import { PaymentHistoryTab } from './components/PaymentHistoryTab'
import type { PaymentDetailTab } from './payment.types'
import './payment-hero.css'

const TABS: { id: PaymentDetailTab; label: string }[] = [
  { id: 'overview', label: PAYMENT_DETAIL_TAB_LABELS.overview },
  { id: 'allocations', label: PAYMENT_DETAIL_TAB_LABELS.allocations },
  { id: 'history', label: PAYMENT_DETAIL_TAB_LABELS.history },
]

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const paymentId = id ?? ''
  const { payment, status, activeTab, setActiveTab, refresh, handleDelete } = usePaymentDetail(paymentId)

  const [deleteOpen, setDeleteOpen] = useState(false)

  const confirmDelete = () => {
    setDeleteOpen(false)
    handleDelete()
  }

  const headerActions = payment ? (
    <>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(ROUTES.PAYMENT_EDIT.replace(':id', paymentId))}
        aria-label={t.editPayment}
      >
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteOpen(true)} aria-label={t.deletePayment}>
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </>
  ) : null

  return (
    <>
      <AppShell>
        <Header title={t.paymentDetail} backTo={ROUTES.PAYMENTS} actions={headerActions} />

      <PageContainer className="space-y-6">
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
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(ROUTES.PAYMENTS)}
                aria-label={t.goBackToPayments}
              >
                {t.backToPayments}
              </button>
            }
          />
        )}

        {/* Success */}
        {status === 'success' && payment && (
          <div className="stagger-enter">
            <div role="status" aria-live="polite" className="sr-only">
              {t.paymentDetailsLoaded}
            </div>
            <PaymentDetailHero
              type={payment.type}
              partyName={payment.partyName}
              amount={payment.amount}
              date={payment.date}
              mode={payment.mode}
            />

            {/* Pill tabs */}
            <div className="pill-tabs" role="tablist" aria-label={t.paymentDetailSections}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} ${t.tabContent}`}>
              {activeTab === 'overview' && (
                <PaymentOverviewTab
                  type={payment.type}
                  date={payment.date}
                  mode={payment.mode}
                  referenceNumber={payment.referenceNumber}
                  amount={payment.amount}
                  discount={payment.discount}
                  unallocatedAmount={payment.unallocatedAmount}
                  notes={payment.notes}
                />
              )}
              {activeTab === 'allocations' && (
                <PaymentAllocationsTab allocations={payment.allocations} />
              )}
              {activeTab === 'history' && <PaymentHistoryTab />}
            </div>
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
