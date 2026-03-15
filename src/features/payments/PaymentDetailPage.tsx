/** Payment Detail — Page (lazy loaded)
 *
 * Follows InvoiceDetailPage.tsx pattern: hero header card,
 * pill tabs (Overview / Allocations / History), 4 UI states.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { usePaymentDetail } from './usePaymentDetail'
import { PAYMENT_TYPE_LABELS, PAYMENT_DETAIL_TAB_LABELS } from './payment.constants'
import { formatPaymentMode } from './payment.utils'
import type { PaymentDetailTab } from './payment.types'
import './payments.css'

const TABS: { id: PaymentDetailTab; label: string }[] = [
  { id: 'overview', label: PAYMENT_DETAIL_TAB_LABELS.overview },
  { id: 'allocations', label: PAYMENT_DETAIL_TAB_LABELS.allocations },
  { id: 'history', label: PAYMENT_DETAIL_TAB_LABELS.history },
]

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const paymentId = id ?? ''
  const { payment, status, activeTab, setActiveTab, refresh, handleDelete } = usePaymentDetail(paymentId)

  const headerActions = payment ? (
    <>
      <button className="btn btn-ghost btn-sm" aria-label="Edit payment">
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button className="btn btn-ghost btn-sm" onClick={handleDelete} aria-label="Delete payment">
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </>
  ) : null

  return (
    <AppShell>
      <Header title="Payment Detail" backTo={ROUTES.PAYMENTS} actions={headerActions} />

      <PageContainer>
        {/* Loading */}
        {status === 'loading' && (
          <>
            <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 160 }}>
              <Skeleton height="1.5rem" width="60%" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Skeleton height="1rem" width="40%" />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton height="2.5rem" width="50%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
            </div>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title="Could not load payment"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {/* Not found */}
        {status === 'success' && !payment && (
          <EmptyState
            icon={<Banknote size={40} aria-hidden="true" />}
            title="Payment not found"
            description="This payment may have been deleted."
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(ROUTES.PAYMENTS)}
                aria-label="Go back to payments list"
              >
                Back to Payments
              </button>
            }
          />
        )}

        {/* Success */}
        {status === 'success' && payment && (
          <>
            {/* Hero card */}
            <div className={`card-primary payment-hero ${payment.type === 'PAYMENT_IN' ? 'payment-hero-in' : 'payment-hero-out'}`}>
              <span className="payment-hero-type">{PAYMENT_TYPE_LABELS[payment.type]}</span>
              <span className="payment-hero-party">{payment.partyName}</span>
              <span className="payment-hero-amount">{formatAmount(payment.amount)}</span>
              <span className="payment-hero-date">
                {formatDate(payment.date)} · {formatPaymentMode(payment.mode)}
              </span>
            </div>

            {/* Pill tabs */}
            <div className="pill-tabs" role="tablist" aria-label="Payment detail sections">
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

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} tab content`}>
              {/* Overview */}
              {activeTab === 'overview' && (
                <div className="card payment-overview-card">
                  <div className="payment-info-row">
                    <span className="payment-info-label">Type</span>
                    <span className="payment-info-value">{PAYMENT_TYPE_LABELS[payment.type]}</span>
                  </div>
                  <div className="payment-info-row">
                    <span className="payment-info-label">Date</span>
                    <span className="payment-info-value">{formatDate(payment.date)}</span>
                  </div>
                  <div className="payment-info-row">
                    <span className="payment-info-label">Mode</span>
                    <span className="payment-info-value">{formatPaymentMode(payment.mode)}</span>
                  </div>
                  {payment.referenceNumber && (
                    <div className="payment-info-row">
                      <span className="payment-info-label">Reference</span>
                      <span className="payment-info-value">{payment.referenceNumber}</span>
                    </div>
                  )}
                  <div className="payment-info-row payment-info-total">
                    <span className="payment-info-label">Amount</span>
                    <span className="payment-info-value">{formatAmount(payment.amount)}</span>
                  </div>
                  {payment.discount && (
                    <div className="payment-info-row">
                      <span className="payment-info-label">Discount</span>
                      <span className="payment-info-value" style={{ color: 'var(--color-error-600)' }}>
                        -{formatAmount(payment.discount.calculatedAmount)}
                        {payment.discount.reason && ` (${payment.discount.reason})`}
                      </span>
                    </div>
                  )}
                  <div className="payment-info-row">
                    <span className="payment-info-label">Unallocated</span>
                    <span className="payment-info-value">
                      {payment.unallocatedAmount > 0 ? formatAmount(payment.unallocatedAmount) : 'Fully allocated'}
                    </span>
                  </div>
                  {payment.notes && (
                    <div className="payment-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
                      <span className="payment-info-label">Notes</span>
                      <p style={{ lineHeight: 1.5, color: 'var(--color-gray-700)' }}>{payment.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Allocations */}
              {activeTab === 'allocations' && (
                <div className="payment-allocations-tab">
                  {payment.allocations.length === 0 ? (
                    <EmptyState
                      icon={<Banknote size={32} aria-hidden="true" />}
                      title="Not linked to any invoice"
                      description="This payment is recorded as an advance."
                    />
                  ) : (
                    <div className="payment-allocations-list" role="list" aria-label="Invoice allocations">
                      {payment.allocations.map((alloc) => (
                        <div key={alloc.id} className="card payment-alloc-card" role="listitem">
                          <div className="payment-alloc-header">
                            <span className="payment-alloc-invoice">{alloc.invoiceNumber}</span>
                            <span className="payment-alloc-amount">{formatAmount(alloc.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History */}
              {activeTab === 'history' && (
                <div className="payment-history-tab">
                  <EmptyState
                    icon={<Banknote size={32} aria-hidden="true" />}
                    title="No edit history"
                    description="Changes to this payment will appear here."
                  />
                </div>
              )}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
