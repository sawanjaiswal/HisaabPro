/**
 * CouponsPage — Admin coupon management
 * Feature #96 | 4 UI states: loading, error, empty, success
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Plus, Search } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useCoupons } from './useCoupons'
import { CouponCard } from './components/CouponCard'
import { CouponForm } from './components/CouponForm'
import { STATUS_LABELS } from './coupon.constants'
import { isCouponListEmpty } from './coupon.utils'
import type { CouponStatus } from './coupon.types'
import './coupon.css'
import { useLanguage } from '@/hooks/useLanguage'

const STATUS_OPTIONS: Array<{ value: CouponStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as CouponStatus,
    label,
  })),
]

export default function CouponsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const {
    coupons,
    total,
    nextCursor,
    status,
    statusFilter,
    searchQuery,
    refresh,
    setStatusFilter,
    setSearchQuery,
    loadMore,
    handleCreate,
    handleDeactivate,
  } = useCoupons()

  const [showForm, setShowForm] = useState(false)

  const onView = useCallback(
    (id: string) => navigate(`/admin/coupons/${id}`),
    [navigate]
  )

  const onFormSubmit = useCallback(
    async (data: Parameters<typeof handleCreate>[0]) => {
      const result = await handleCreate(data)
      if (result) setShowForm(false)
    },
    [handleCreate]
  )

  return (
    <>
      <Header
        title={t.coupons ?? "Coupons"}
        actions={
          <button
            className="coupon-add-btn"
            onClick={() => setShowForm(true)}
            aria-label="Create coupon"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        }
      />

      <PageContainer>
        {/* Search + filter bar */}
        <div className="coupon-toolbar">
          <div className="coupon-search">
            <Search size={16} aria-hidden="true" className="coupon-search-icon" />
            <input
              type="search"
              className="coupon-search-input"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search coupon codes"
            />
          </div>
          <select
            className="coupon-filter"
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value as CouponStatus) || undefined)
            }
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="coupon-skeleton-list" aria-busy="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className="coupon-skeleton-card">
                <Skeleton width="60%" height="1rem" />
                <Skeleton width="40%" height="0.875rem" />
                <Skeleton width="80%" height="0.75rem" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldntLoadCoupons}
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {/* Empty */}
        {status === 'success' && isCouponListEmpty(coupons) && (
          <EmptyState
            icon={<Tag size={48} aria-hidden="true" />}
            title={t.noCouponsYet}
            description={t.createFirstCoupon}
            action={
              <button
                className="coupon-empty-cta"
                onClick={() => setShowForm(true)}
              >
                Create Coupon
              </button>
            }
          />
        )}

        {/* Success — list */}
        {status === 'success' && !isCouponListEmpty(coupons) && (
          <>
            <p className="coupon-count">{total} coupon{total !== 1 ? 's' : ''}</p>
            <div className="coupon-list">
              {coupons.map((coupon) => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  onView={onView}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
            {nextCursor && (
              <button className="coupon-load-more" onClick={loadMore}>
                Load More
              </button>
            )}
          </>
        )}
      </PageContainer>

      {/* Create coupon drawer */}
      {showForm && (
        <div className="coupon-form-overlay" onClick={() => setShowForm(false)} role="presentation">
          <div
            className="coupon-form-sheet"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setShowForm(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Create coupon"
          >
            <CouponForm onSubmit={onFormSubmit} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </>
  )
}
