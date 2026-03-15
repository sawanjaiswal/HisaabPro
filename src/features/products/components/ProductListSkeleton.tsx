/** Product list loading state — 6 shimmer rows */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

const SKELETON_COUNT = 6

export const ProductListSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading products">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={`skeleton-product-${i}`}
          className="txn-row"
          style={{ minHeight: '44px', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <Skeleton width="44px" height="44px" borderRadius="var(--radius-md)" />

          <div className="txn-info" style={{ gap: 'var(--space-2)' }}>
            <Skeleton width="150px" height="1rem" />
            <Skeleton width="90px" height="0.75rem" />
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <Skeleton width="72px" height="1rem" />
            <Skeleton width="48px" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  )
}
