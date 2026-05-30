/** BomListPage — /bom — list all BOMs with 4 UI states */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useBomList } from '../hooks/useBom'
import { formatVersionBadge } from '../bom.utils'
import type { BomListFilters } from '../bom.types'
import '../bom.css'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BomListSkeleton() {
  return (
    <div className="bom-skeleton" aria-busy="true" aria-label="Loading recipes">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bom-skeleton__card" />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BomListPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<BomListFilters>({ page: 1 })
  const { items, pagination, status, refresh } = useBomList(filters)

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }))

  return (
    <div className="bom-page">
      {/* Header */}
      <div className="bom-page__header">
        <div>
          <h1 className="bom-page__title">Recipes</h1>
          {status === 'success' && (
            <p className="bom-page__subtitle">{pagination.total} recipe{pagination.total !== 1 ? 's' : ''}</p>
          )}
        </div>
        <Button
          type="button"
          variant="primary" size="sm"
          onClick={() => navigate('/bom/new')}
          aria-label="Create new recipe"
        >
          <Plus size={16} aria-hidden="true" />
          New Recipe
        </Button>
      </div>

      {/* Loading */}
      {status === 'loading' && <BomListSkeleton />}

      {/* Error */}
      {status === 'error' && (
        <ErrorState
          title="Could not load recipes"
          message="Check your connection and try again."
          onRetry={refresh}
        />
      )}

      {/* Empty */}
      {status === 'success' && items.length === 0 && (
        <EmptyState
          icon={<BookOpen size={22} aria-hidden="true" />}
          title="No recipes yet"
          description="Create a Bill of Materials to start tracking production."
          action={
            <Button type="button" variant="primary" onClick={() => navigate('/bom/new')}>
              <Plus size={16} aria-hidden="true" /> New Recipe
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
              aria-label={`Recipe: ${bom.name}`}
            >
              <div className="bom-card__top">
                <span className="bom-card__product">{bom.productName}</span>
                <div className="bom-card__badges">
                  <span className="badge badge--neutral">{formatVersionBadge(bom.version)}</span>
                  {bom.isDefault && <span className="badge badge--primary">Default</span>}
                  {!bom.isActive && <span className="badge badge--warning">Inactive</span>}
                </div>
              </div>
              <div className="bom-card__bottom">
                <span className="bom-card__name">{bom.name}</span>
                <div className="bom-card__actions">
                  <span className="bom-card__count">{bom.componentCount} component{bom.componentCount !== 1 ? 's' : ''}</span>
                  <Button variant="none"
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/production-runs/new?bomId=${bom.id}`)
                    }}
                    aria-label={`Start production run for ${bom.name}`}
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
        <div className="bom-pagination" role="navigation" aria-label="Pagination">
          <Button
            type="button"
            variant="ghost" size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="bom-pagination__label">Page {pagination.page}</span>
          <Button
            type="button"
            variant="ghost" size="sm"
            disabled={!pagination.hasMore}
            onClick={() => setPage(pagination.page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
