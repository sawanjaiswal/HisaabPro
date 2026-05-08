/** ProductionRunDetailPage — /production-runs/:id */

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Activity, RefreshCw } from 'lucide-react'
import { useProductionRunDetail } from '../hooks/useProductionRuns'
import { ProductionRunCancelButton } from '../components/ProductionRunCancelButton'
import { PR_STATUS_BADGE_CLASS, PR_STATUS_LABELS } from '../production-run.constants'
import { formatRunDate, formatCostPaise } from '../production-run.utils'
import '../production-run.css'

function PRDetailSkeleton() {
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label="Loading run">
      <div className="bom-skeleton__card" style={{ height: 100 }} />
      {[0, 1, 2].map((i) => <div key={i} className="bom-skeleton__card" style={{ height: 48 }} />)}
    </div>
  )
}

export default function ProductionRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { run, status, refresh } = useProductionRunDetail(id ?? '')

  if (!id) return null

  return (
    <div className="bom-page">
      {/* Back */}
      <div className="bom-page__header">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/production-runs')} aria-label="Back to production runs">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="bom-page__title">Production Run</h1>
      </div>

      {/* Loading */}
      {status === 'loading' && <PRDetailSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <div className="bom-empty" role="alert">
          <Activity size={40} className="bom-empty__icon bom-empty__icon--error" aria-hidden="true" />
          <p className="bom-empty__title">Could not load run</p>
          <button type="button" className="btn btn-primary" onClick={refresh}>
            <RefreshCw size={16} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {/* Success */}
      {status === 'success' && run && (
        <>
          {/* Summary */}
          <div className="bom-detail-card">
            <div className="bom-detail-card__header">
              <div>
                <div className="bom-detail-card__product">{run.finishedProductName}</div>
                <div className="bom-detail-card__name">{run.bomName} · v{run.bomVersion}</div>
              </div>
              <span className={PR_STATUS_BADGE_CLASS[run.status] ?? 'badge'}>
                {PR_STATUS_LABELS[run.status] ?? run.status}
              </span>
            </div>
            {run.notes && <p className="bom-detail-card__notes">{run.notes}</p>}
            <div className="bom-detail-card__meta">
              <span>Qty: {run.quantityProduced}</span>
              <span>{formatRunDate(run.runDate)}</span>
              <span>By {run.createdByName}</span>
            </div>
          </div>

          {/* Warnings */}
          {run.warnings.length > 0 && (
            <div className="pr-wizard-banner pr-wizard-banner--warning" role="status">
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {run.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Components consumed */}
          <section className="bom-section">
            <h2 className="bom-section__title">Components Consumed</h2>
            <div className="pr-components-table-wrap">
              {run.components.map((c) => (
                <div key={c.componentProductId} className="pr-component-row">
                  <span className="pr-component-row__name">{c.componentProductName}</span>
                  <span className="pr-component-row__qty">{c.quantityConsumed}</span>
                  <span className="pr-component-row__cost">{formatCostPaise(c.lineTotalPaise)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Cost summary */}
          <div className="pr-cost-summary">
            <div className="pr-cost-row">
              <span>Total component cost</span>
              <strong>{formatCostPaise(run.totalCostPaise)}</strong>
            </div>
            <div className="pr-cost-row">
              <span>Per-unit cost</span>
              <strong>{formatCostPaise(run.perUnitCostPaise)}</strong>
            </div>
          </div>

          {/* Cancel — only for COMPLETED runs, positioned at bottom */}
          {run.status === 'COMPLETED' && (
            <div className="pr-cancel-wrap">
              <ProductionRunCancelButton
                runId={id}
                bomName={run.bomName}
                onCancelled={() => navigate('/production-runs')}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
