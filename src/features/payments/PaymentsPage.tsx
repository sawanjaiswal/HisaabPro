/** Payments — List Page (lazy loaded)
 *
 * Follows InvoicesPage.tsx pattern: summary bar, filter bar,
 * card list, 4 UI states, FAB for create.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { usePayments } from './usePayments'
import { PaymentSummaryBar } from './components/PaymentSummaryBar'
import { PaymentFilterBar } from './components/PaymentFilterBar'
import { PaymentCard } from './components/PaymentCard'
import { PaymentListSkeleton } from './components/PaymentListSkeleton'
import type { PaymentType, PaymentMode } from './payment.types'
import './payments.css'

export default function PaymentsPage() {
  const navigate = useNavigate()
  const [activeType, setActiveType] = useState<PaymentType | 'ALL'>('ALL')
  const [activeMode, setActiveMode] = useState<PaymentMode | 'ALL'>('ALL')

  const { data, status, filters, setSearch, setFilter, refresh } = usePayments({
    type: activeType === 'ALL' ? undefined : activeType,
  })

  const handlePaymentClick = (id: string) => navigate(`/payments/${id}`)

  const handleTypeChange = (type: PaymentType | 'ALL') => {
    setActiveType(type)
    if (type === 'ALL') {
      setFilter('type', undefined as unknown as PaymentType)
    } else {
      setFilter('type', type)
    }
  }

  const handleModeChange = (mode: PaymentMode | 'ALL') => {
    setActiveMode(mode)
    if (mode === 'ALL') {
      setFilter('mode', undefined as unknown as PaymentMode)
    } else {
      setFilter('mode', mode)
    }
  }

  return (
    <AppShell>
      <Header title="Payments" />

      <PageContainer>
        {status === 'success' && data && <PaymentSummaryBar summary={data.summary} />}

        <PaymentFilterBar
          search={filters.search ?? ''}
          onSearchChange={setSearch}
          activeType={activeType}
          onTypeChange={handleTypeChange}
          activeMode={activeMode}
          onModeChange={handleModeChange}
        />

        {status === 'loading' && <PaymentListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title="Could not load payments"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.payments.length === 0 && (
          <EmptyState
            icon={<Banknote size={40} aria-hidden="true" />}
            title="No payments recorded yet"
            description="Record your first payment to start tracking money in & out"
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`)}
                aria-label="Record first payment"
              >
                Record Payment In
              </button>
            }
          />
        )}

        {status === 'success' && data && data.payments.length > 0 && (
          <div className="payment-list" role="list" aria-label="Payments">
            {data.payments.map((payment) => (
              <div key={payment.id} className="payment-list-row" role="listitem">
                <PaymentCard payment={payment} onClick={handlePaymentClick} />
              </div>
            ))}
          </div>
        )}
      </PageContainer>

      <button
        className="fab"
        onClick={() => navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`)}
        aria-label="Record new payment"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
