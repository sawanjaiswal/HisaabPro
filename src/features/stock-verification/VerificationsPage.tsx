import { useNavigate } from 'react-router-dom'
import { Plus, ClipboardList } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useVerifications } from './useVerifications'
import { STATUS_LABELS } from './stock-verification.constants'
import { VerificationCard } from './components/VerificationCard'
import type { VerificationStatus } from './stock-verification.types'
import './stock-verification.css'
import { useLanguage } from '@/hooks/useLanguage'

const FILTER_TABS: Array<{ value: VerificationStatus | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
  { value: 'IN_PROGRESS', label: STATUS_LABELS.IN_PROGRESS },
  { value: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
]

export default function VerificationsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { verifications, status, error, refetch, createVerification, isCreating, statusFilter, setStatusFilter } = useVerifications()

  const handleCreate = async () => {
    const id = await createVerification()
    if (id) navigate(ROUTES.STOCK_VERIFICATION_DETAIL.replace(':id', id))
  }

  return (
    <AppShell>
      <Header
        title={t.stockVerification}
        actions={
          <button type="button" className="sv-page__create-btn space-y-6" onClick={handleCreate} disabled={isCreating} aria-label={t.newStockCount}>
            <Plus size={18} aria-hidden="true" />
            {t.newCount}
          </button>
        }
      />

      <PageContainer>
        <nav className="sv-tabs stagger-filters" aria-label={t.status}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={`sv-tabs__tab ${statusFilter === tab.value ? 'sv-tabs__tab--active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
              aria-pressed={statusFilter === tab.value}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {status === 'loading' && (
          <div className="sv-skeleton-list" aria-busy="true">
            <Skeleton height="7rem" borderRadius="var(--radius-md)" count={3} />
          </div>
        )}

        {status === 'error' && (
          <ErrorState title={t.couldNotLoadVerifications} message={error?.message} onRetry={refetch} />
        )}

        {status === 'success' && verifications.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={28} aria-hidden="true" />}
            title={t.noVerificationsYet}
            description={t.startStockCountDesc}
            action={
              <button type="button" className="sv-page__create-btn space-y-6" onClick={handleCreate} disabled={isCreating}>
                <Plus size={16} aria-hidden="true" /> {t.startFirstCount}
              </button>
            }
          />
        )}

        {status === 'success' && verifications.length > 0 && (
          <div className="sv-list stagger-list">
            {verifications.map((v) => (
              <VerificationCard key={v.id} verification={v} onClick={() => navigate(ROUTES.STOCK_VERIFICATION_DETAIL.replace(':id', v.id))} />
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
