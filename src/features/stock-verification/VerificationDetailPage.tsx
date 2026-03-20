import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useVerificationDetail } from './useVerificationDetail'
import { STATUS_LABELS } from './stock-verification.constants'
import { getVerificationProgress, getStatusBadgeStyle } from './stock-verification.utils'
import { ProgressBar } from './components/ProgressBar'
import { CountItemRow } from './components/CountItemRow'
import { DiscrepancyRow } from './components/DiscrepancyRow'
import './stock-verification.css'

export default function VerificationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { verification, items, status, error, refetch, recordCount, completeVerification, adjustStock, isProcessing } = useVerificationDetail(id)
  const [showAdjustConfirm, setShowAdjustConfirm] = useState(false)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Stock Verification" backTo={ROUTES.STOCK_VERIFICATION} />
        <PageContainer>
          <div aria-busy="true">
            <Skeleton height="2rem" width="60%" />
            <Skeleton height="1rem" width="40%" />
            <Skeleton height="5rem" borderRadius="var(--radius-md)" count={4} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="Stock Verification" backTo={ROUTES.STOCK_VERIFICATION} />
        <PageContainer>
          <ErrorState title="Could not load verification" message={error?.message} onRetry={refetch} />
        </PageContainer>
      </AppShell>
    )
  }

  if (!verification) return null

  const { percentage, label } = getVerificationProgress(verification.totalItems, verification.countedItems)
  const badgeStyle = getStatusBadgeStyle(verification.status)
  const isCounting = verification.status === 'DRAFT' || verification.status === 'IN_PROGRESS'
  const isCompleted = verification.status === 'COMPLETED'
  const allCounted = verification.countedItems === verification.totalItems
  const hasDiscrepancies = verification.discrepancies > 0

  return (
    <AppShell>
      <Header
        title="Stock Verification"
        backTo={ROUTES.STOCK_VERIFICATION}
        actions={
          <span className="sv-detail__badge" style={badgeStyle}>
            {STATUS_LABELS[verification.status]}
          </span>
        }
      />

      <PageContainer>
        <ProgressBar percentage={percentage} label={label} />

        {isCounting && (
          <section className="sv-detail__section">
            <h2 className="sv-detail__section-title">Count Items</h2>
            <div className="sv-detail__items">
              {items.map((item) => (
                <CountItemRow key={item.id} item={item} onSave={recordCount} disabled={isProcessing} />
              ))}
            </div>
            {allCounted && (
              <button
                type="button"
                className="sv-detail__action-btn sv-detail__action-btn--primary"
                onClick={() => completeVerification()}
                disabled={isProcessing}
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                Complete Verification
              </button>
            )}
          </section>
        )}

        {(isCompleted || (isCounting && allCounted)) && (
          <section className="sv-detail__section">
            <h2 className="sv-detail__section-title">
              Discrepancy Summary
              {hasDiscrepancies && <span className="sv-detail__disc-count">{verification.discrepancies}</span>}
            </h2>
            <div className="sv-detail__items">
              {items.map((item) => (
                <DiscrepancyRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {isCompleted && hasDiscrepancies && (
          <button
            type="button"
            className="sv-detail__action-btn sv-detail__action-btn--warning"
            onClick={() => setShowAdjustConfirm(true)}
            disabled={isProcessing}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Adjust Stock
          </button>
        )}

        <ConfirmDialog
          open={showAdjustConfirm}
          onClose={() => setShowAdjustConfirm(false)}
          onConfirm={() => { adjustStock(); setShowAdjustConfirm(false) }}
          title="Adjust Stock?"
          description="This will adjust stock levels for all discrepant items. This action cannot be undone."
          confirmLabel="Adjust Stock"
          isDanger={true}
          isLoading={isProcessing}
        />
      </PageContainer>
    </AppShell>
  )
}
