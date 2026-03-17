/** ReconciliationListPage
 *
 * Lists past GSTR-1 reconciliations with status, period, and counts.
 * Floating "+" button opens an inline form to start a new reconciliation.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, GitMerge } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useReconciliationList } from './useReconciliationList'
import { ReconciliationUploadForm } from './components/ReconciliationUploadForm'
import { formatCurrency } from '@/lib/format'
import { RECON_STATUS_LABELS, RECON_TYPE_LABELS } from './reconciliation.constants'
import './reconciliation.css'

export default function ReconciliationListPage() {
  const navigate = useNavigate()
  const { items, status, hasMore, loadMore, refresh } = useReconciliationList()
  const [showForm, setShowForm] = useState(false)

  const handleNewSuccess = (id: string) => {
    setShowForm(false)
    navigate(ROUTES.GST_RECONCILIATION_DETAIL.replace(':id', id))
  }

  if (status === 'loading' && items.length === 0) {
    return (
      <AppShell>
        <Header title="GSTR-1 Reconciliation" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="recon-list-skeleton">
            {[1, 2, 3].map((n) => <div key={n} className="recon-list-skeleton__item" aria-hidden="true" />)}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="GSTR-1 Reconciliation" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState
            title="Could not load reconciliations"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="GSTR-1 Reconciliation" backTo={ROUTES.REPORTS} />
      <PageContainer>

        {showForm && (
          <div className="recon-new-form-panel">
            <h2 className="recon-new-form-panel__title">New Reconciliation</h2>
            <ReconciliationUploadForm onSuccess={handleNewSuccess} />
          </div>
        )}

        {!showForm && items.length === 0 && (
          <div className="recon-empty">
            <div className="recon-empty__icon" aria-hidden="true"><GitMerge size={32} /></div>
            <p className="recon-empty__title">No reconciliations yet</p>
            <p className="recon-empty__desc">Upload your GSTR-1 data to compare against books.</p>
            <button
              type="button"
              className="recon-empty__cta"
              onClick={() => setShowForm(true)}
            >
              Start your first reconciliation
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="recon-list">
            {items.map((item) => (
              <div
                key={item.id}
                className="recon-list-card"
                role="button"
                tabIndex={0}
                aria-label={`Reconciliation ${item.period}`}
                onClick={() => navigate(ROUTES.GST_RECONCILIATION_DETAIL.replace(':id', item.id))}
                onKeyDown={(e) => e.key === 'Enter' && navigate(ROUTES.GST_RECONCILIATION_DETAIL.replace(':id', item.id))}
              >
                <div className="recon-list-card__header">
                  <span className="recon-list-card__period">{item.period}</span>
                  <span className={`recon-list-card__status recon-list-card__status--${item.status.toLowerCase()}`}>
                    {RECON_STATUS_LABELS[item.status]}
                  </span>
                </div>
                <div className="recon-list-card__type">{RECON_TYPE_LABELS[item.reconType]}</div>
                <div className="recon-list-card__counts">
                  <span className="recon-list-card__count recon-list-card__count--success">{item.matchedCount} matched</span>
                  <span className="recon-list-card__count recon-list-card__count--warning">{item.mismatchedCount} mismatched</span>
                  <span className="recon-list-card__count recon-list-card__count--error">{item.missingInGstrCount} missing</span>
                </div>
                {item.status === 'COMPLETED' && (
                  <div className="recon-list-card__diff">
                    Difference: {formatCurrency(Math.abs(item.differenceValue))}
                    {' · '}
                    {item.totalInvoices} invoices
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <button type="button" className="recon-load-more" onClick={loadMore}>
            Load more
          </button>
        )}

        <button
          type="button"
          className="recon-fab"
          aria-label="Start new reconciliation"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </PageContainer>
    </AppShell>
  )
}
