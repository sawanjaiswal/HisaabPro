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
import { useLanguage } from '@/hooks/useLanguage'

export default function VerificationDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const { verification, items, status, error, refetch, recordCount, completeVerification, adjustStock, isProcessing } = useVerificationDetail(id)
  const [showAdjustConfirm, setShowAdjustConfirm] = useState(false)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.stockVerification} backTo={ROUTES.STOCK_VERIFICATION} />
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
        <Header title={t.stockVerification} backTo={ROUTES.STOCK_VERIFICATION} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadVerification} message={error?.message} onRetry={refetch} />
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
        title={t.stockVerification}
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
          <section className="sv-detail__section fade-up">
            <h2 className="sv-detail__section-title">{t.countItems}</h2>
            <div className="sv-detail__items stagger-list">
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
                {t.completeVerification}
              </button>
            )}
          </section>
        )}

        {(isCompleted || (isCounting && allCounted)) && (
          <section className="sv-detail__section">
            <h2 className="sv-detail__section-title">
              {t.discrepancySummary}
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
            {t.adjustStock}
          </button>
        )}

        <ConfirmDialog
          open={showAdjustConfirm}
          onClose={() => setShowAdjustConfirm(false)}
          onConfirm={() => { adjustStock(); setShowAdjustConfirm(false) }}
          title={t.adjustStockTitle}
          description={t.adjustStockDesc}
          confirmLabel={t.adjustStock}
          isDanger={true}
          isLoading={isProcessing}
        />
      </PageContainer>
    </AppShell>
  )
}
