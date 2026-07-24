/** ProductionRunListPage — /production-runs — 4 UI states */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Plus, Activity, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useProductionRunList } from '../hooks/useProductionRuns'
import { PR_STATUS_BADGE_CLASS } from '../production-run.constants'
import { formatRunDate, formatCostPaise } from '../production-run.utils'
import { useLanguage } from '@/context/LanguageContext'
import type { ProductionRunListFilters, ProductionRunStatus } from '../production-run.types'
import '../production-run.css'

function PRListSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label={t.prLoadingRuns}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bom-skeleton__card" style={{ height: 80 }} />
      ))}
    </div>
  )
}

export default function ProductionRunListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [filters, setFilters] = useState<ProductionRunListFilters>({ page: 1 })
  const { items, pagination, status, refresh } = useProductionRunList(filters)

  const STATUS_OPTIONS: Array<{ value: '' | ProductionRunStatus; label: string }> = [
    { value: '', label: t.all },
    { value: 'COMPLETED', label: t.prStatusCompleted },
    { value: 'CANCELLED', label: t.prStatusCancelled },
    { value: 'DRAFT', label: t.prStatusDraft },
  ]
  const statusLabel: Record<string, string> = {
    DRAFT: t.prStatusDraft,
    COMPLETED: t.prStatusCompleted,
    CANCELLED: t.prStatusCancelled,
  }

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }))
  const setStatus = (s: '' | ProductionRunStatus) =>
    setFilters((f) => ({ ...f, status: s || undefined, page: 1 }))

  return (
    <div className="bom-page">
      {/* Header */}
      <div className="bom-page__header">
        <div>
          <h1 className="bom-page__title">{t.prTitle}</h1>
          {status === 'success' && (
            <p className="bom-page__subtitle">{pagination.total} {pagination.total !== 1 ? t.prRuns : t.prRun}</p>
          )}
        </div>
        <Button
          type="button"
          variant="primary" size="sm"
          onClick={() => navigate('/production-runs/new')}
          aria-label={t.prStartRunAria}
        >
          <Plus size={16} aria-hidden="true" /> {t.prStartRun}
        </Button>
      </div>

      {/* Status filter */}
      <div className="pr-filter-bar" role="group" aria-label={t.prFilterByStatus}>
        {STATUS_OPTIONS.map((opt) => (
          <Button variant="none"
            key={opt.value}
            type="button"
            className={`pr-filter-chip${(filters.status ?? '') === opt.value ? ' is-active' : ''}`}
            onClick={() => setStatus(opt.value)}
            aria-pressed={(filters.status ?? '') === opt.value}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Loading */}
      {status === 'loading' && <PRListSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <ErrorState
          title={t.prLoadErrorTitle}
          onRetry={refresh}
        />
      )}

      {/* Empty */}
      {status === 'success' && items.length === 0 && (
        <EmptyState
          icon={<Activity size={22} aria-hidden="true" />}
          title={t.prEmptyTitle}
          description={t.prEmptyDesc}
          action={
            <Button type="button" variant="primary" onClick={() => navigate('/production-runs/new')}>
              <Plus size={16} aria-hidden="true" /> {t.prStartRun}
            </Button>
          }
        />
      )}

      {/* List */}
      {status === 'success' && items.length > 0 && (
        <div className="bom-list" role="list">
          {items.map((run) => (
            <div
              key={run.id}
              className="pr-card"
              role="listitem"
              onClick={() => navigate(`/production-runs/${run.id}`)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/production-runs/${run.id}`) }}
              aria-label={`${t.prRunLabel}: ${run.bomName}`}
            >
              <div className="pr-card__top">
                <span className="pr-card__product">{run.finishedProductName}</span>
                <span className={PR_STATUS_BADGE_CLASS[run.status] ?? 'badge'}>
                  {statusLabel[run.status] ?? run.status}
                </span>
              </div>
              <div className="pr-card__middle">
                <span className="pr-card__bom">{run.bomName}</span>
              </div>
              <div className="pr-card__bottom">
                <span className="pr-card__qty">{t.qty}: {run.quantityProduced}</span>
                <span className="pr-card__date">{formatRunDate(run.runDate)}</span>
                <span className="pr-card__cost">{formatCostPaise(run.totalCostPaise)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {status === 'success' && (pagination.page > 1 || pagination.hasMore) && (
        <div className="bom-pagination" role="navigation" aria-label={t.pagination}>
          <Button type="button" variant="ghost" size="sm" disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)} aria-label={t.previousPage}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="bom-pagination__label">{t.pageLabel} {pagination.page}</span>
          <Button type="button" variant="ghost" size="sm" disabled={!pagination.hasMore}
            onClick={() => setPage(pagination.page + 1)} aria-label={t.nextPage}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
