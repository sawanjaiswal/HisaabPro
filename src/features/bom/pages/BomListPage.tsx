/** BomListPage — /bom — list all BOMs with 4 UI states */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useBomList } from '../hooks/useBom'
import { useLanguage } from '@/context/LanguageContext'
import { formatVersionBadge } from '../bom.utils'
import type { BomListFilters } from '../bom.types'
import '../bom.css'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BomListSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label={t.bomLoadingRecipes}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bom-skeleton__card" />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BomListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [filters, setFilters] = useState<BomListFilters>({ page: 1 })
  const { items, pagination, status, refresh } = useBomList(filters)

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }))

  return (
    <div className="bom-page">
      {/* Header */}
      <div className="bom-page__header">
        <div>
          <h1 className="bom-page__title">{t.bomRecipes}</h1>
          {status === 'success' && (
            <p className="bom-page__subtitle">{pagination.total} {pagination.total !== 1 ? t.bomRecipesLower : t.bomRecipe}</p>
          )}
        </div>
        <Button
          type="button"
          variant="primary" size="sm"
          onClick={() => navigate('/bom/new')}
          aria-label={t.bomCreateNewRecipe}
        >
          <Plus size={16} aria-hidden="true" />
          {t.bomNewRecipe}
        </Button>
      </div>

      {/* Loading */}
      {status === 'loading' && <BomListSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <ErrorState
          title={t.bomLoadErrorTitle}
          message={t.bomLoadErrorMsg}
          onRetry={refresh}
        />
      )}

      {/* Empty */}
      {status === 'success' && items.length === 0 && (
        <EmptyState
          icon={<BookOpen size={22} aria-hidden="true" />}
          title={t.bomEmptyTitle}
          description={t.bomEmptyDesc}
          action={
            <Button type="button" variant="primary" onClick={() => navigate('/bom/new')}>
              <Plus size={16} aria-hidden="true" /> {t.bomNewRecipe}
            </Button>
          }
        />
      )}

      {/* List */}
      {status === 'success' && items.length > 0 && (
        <div className="bom-list" role="list">
          {items.map((bom) => (
            <div
              key={bom.id}
              className="bom-card"
              role="listitem"
              onClick={() => navigate(`/bom/${bom.id}`)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/bom/${bom.id}`) }}
              aria-label={`${t.bomRecipe}: ${bom.name}`}
            >
              <div className="bom-card__top">
                <span className="bom-card__product">{bom.productName}</span>
                <div className="bom-card__badges">
                  <span className="badge badge--neutral">{formatVersionBadge(bom.version)}</span>
                  {bom.isDefault && <span className="badge badge--primary">{t.defaultLabel}</span>}
                  {!bom.isActive && <span className="badge badge--warning">{t.inactive}</span>}
                </div>
              </div>
              <div className="bom-card__bottom">
                <span className="bom-card__name">{bom.name}</span>
                <div className="bom-card__actions">
                  <span className="bom-card__count">{bom.componentCount} {bom.componentCount !== 1 ? t.bomComponentsLower : t.bomComponent}</span>
                  <Button variant="none"
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/production-runs/new?bomId=${bom.id}`)
                    }}
                    aria-label={`${t.bomStartRunForAria} ${bom.name}`}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Play size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {status === 'success' && (pagination.page > 1 || pagination.hasMore) && (
        <div className="bom-pagination" role="navigation" aria-label={t.pagination}>
          <Button
            type="button"
            variant="ghost" size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
            aria-label={t.previousPage}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="bom-pagination__label">{t.pageLabel} {pagination.page}</span>
          <Button
            type="button"
            variant="ghost" size="sm"
            disabled={!pagination.hasMore}
            onClick={() => setPage(pagination.page + 1)}
            aria-label={t.nextPage}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
