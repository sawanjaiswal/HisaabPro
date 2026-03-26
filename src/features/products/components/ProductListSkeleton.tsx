/** Product list loading state — 6 shimmer rows */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

const SKELETON_COUNT = 6

export const ProductListSkeleton: React.FC = () => {
  const { t } = useLanguage()
  return (
    <div role="status" aria-label={t.loadingProducts}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={`skeleton-product-${i}`}
          className="txn-row"
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <Skeleton width="44px" height="44px" borderRadius="var(--radius-md)" />

          <div className="txn-info">
            <div className="product-card-header">
              <Skeleton width="150px" height="1rem" />
              <Skeleton width="60px" height="0.875rem" borderRadius="var(--radius-full)" />
            </div>
            <Skeleton width="90px" height="0.75rem" />
          </div>

          <div className="product-card-right">
            <Skeleton width="72px" height="1rem" />
            <Skeleton width="48px" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}
