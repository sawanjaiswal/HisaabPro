/** Payments — List Page (lazy loaded)
 *
 * Follows PartiesPage.tsx pattern: summary bar, filter bar,
 * card list, 4 UI states, FAB for create, bulk select.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePayments } from './usePayments'
import { PaymentSummaryBar } from './components/PaymentSummaryBar'
import { PaymentFilterBar } from './components/PaymentFilterBar'
import { PaymentCard } from './components/PaymentCard'
import { PaymentListSkeleton } from './components/PaymentListSkeleton'
import { deletePayment } from './payment.service'
import type { PaymentType, PaymentMode } from './payment.types'
import type { BulkAction } from '@/components/ui/BulkActionBar'
import './payment-hero.css'
import './payment-filter.css'
import './payment-list.css'

export default function PaymentsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  const [activeType, setActiveType] = useState<PaymentType | 'ALL'>('ALL')
  const [activeMode, setActiveMode] = useState<PaymentMode | 'ALL'>('ALL')
  const bulk = useBulkSelect()
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const { data, status, filters, setSearch, setFilter, refresh } = usePayments({
    type: activeType === 'ALL' ? undefined : activeType,
  })

  const handlePaymentClick = (id: string) => {
    if (bulk.isActive) {
      bulk.toggle(id)
    } else {
      navigate(`/payments/${id}`)
    }
  }

  const handleLongPress = (id: string) => {
    if (!bulk.isActive) {
      bulk.toggle(id)
    }
  }

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

  const handleBulkDelete = async () => {
    const count = bulk.selectedCount
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(bulk.selectedIds)
      await Promise.all(ids.map((id) => deletePayment(id)))
      toast.success(`${count} ${count === 1 ? t.paymentDeleted : t.paymentsDeleted}`)
      bulk.clear()
      refresh()
    } catch {
      toast.error(t.failedDeletePayments)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const allPaymentIds = data?.payments.map((p) => p.id) ?? []

  const bulkActions: BulkAction[] = [
    {
      id: 'delete',
      label: t.delete,
      icon: 'delete',
      isDanger: true,
      onClick: handleBulkDelete,
    },
    {
      id: 'export',
      label: t.export,
      icon: 'export',
      onClick: () => toast.info(t.exportComingSoon),
    },
  ]

  return (
    <AppShell>
      <Header title={bulk.isActive ? `${bulk.selectedCount} ${t.selected}` : t.payments} />

      {status === 'success' && data && !bulk.isActive && (
        <div className="page-hero">
          <PaymentSummaryBar summary={data.summary} />
        </div>
      )}

      <PageContainer className="space-y-6">
        {!bulk.isActive && (
          <PaymentFilterBar
            search={filters.search ?? ''}
            onSearchChange={setSearch}
            activeType={activeType}
            onTypeChange={handleTypeChange}
            activeMode={activeMode}
            onModeChange={handleModeChange}
          />
        )}

        {status === 'loading' && <PaymentListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadPayments}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.payments.length === 0 && (
          <EmptyState
            icon={<Banknote size={40} aria-hidden="true" />}
            title={t.noPaymentsRecordedYet}
            description={t.recordFirstPaymentDesc}
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`)}
                aria-label={t.recordFirstPayment}
              >
                {t.recordPaymentIn}
              </button>
            }
          />
        )}

        {status === 'success' && data && (
          <div role="status" aria-live="polite" className="sr-only">
            {data.payments.length} {data.payments.length === 1 ? t.paymentFound : t.paymentsFound}
          </div>
        )}

        {status === 'success' && data && data.payments.length > 0 && (
          <>
          <h2 className="sr-only">{t.paymentList}</h2>
          <div className="payment-list stagger-list" role="list" aria-label={t.payments}>
            {data.payments.map((payment) => (
              <div
                key={payment.id}
                className={`payment-list-row${bulk.isSelected(payment.id) ? ' bulk-selected' : ''}`}
                role="listitem"
                onClick={(e) => {
                  if (bulk.isActive) {
                    e.stopPropagation()
                    bulk.toggle(payment.id)
                  }
                }}
              >
                <PaymentCard
                  payment={payment}
                  onClick={handlePaymentClick}
                  onLongPress={handleLongPress}
                  isSelected={bulk.isSelected(payment.id)}
                  isBulkMode={bulk.isActive}
                />
              </div>
            ))}
          </div>
          </>
        )}
      </PageContainer>

      {!bulk.isActive && (
        <button
          className="fab"
          onClick={() => navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN`)}
          aria-label={t.recordNewPayment}
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalCount={allPaymentIds.length}
        onSelectAll={() => bulk.selectAll(allPaymentIds)}
        onClear={bulk.clear}
        actions={bulkActions}
        isProcessing={isBulkDeleting}
      />
    </AppShell>
  )
}
