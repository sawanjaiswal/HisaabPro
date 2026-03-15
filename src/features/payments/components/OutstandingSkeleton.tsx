/** Outstanding — skeleton loader: 3 summary cards + 5 party card rows */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

const CARD_COUNT = 5

export const OutstandingSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading outstanding">
      {/* Summary cards skeleton */}
      <div className="outstanding-summary-cards" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={`skeleton-summary-${i}`} className="outstanding-summary-card" style={{ minWidth: '140px' }}>
            <Skeleton width="60px" height="0.6875rem" />
            <Skeleton width="100px" height="1.25rem" />
          </div>
        ))}
      </div>

      {/* Party card skeletons */}
      <div className="outstanding-skeleton" aria-hidden="true">
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <div key={`skeleton-outstanding-${i}`} className="outstanding-skeleton-card">
            <div className="outstanding-skeleton-top">
              <Skeleton
                width="44px"
                height="44px"
                borderRadius="var(--radius-md)"
              />
              <div className="outstanding-skeleton-content">
                <Skeleton width="140px" height="14px" />
                <Skeleton width="90px" height="12px" />
              </div>
              <Skeleton
                width="72px"
                height="1rem"
                borderRadius="var(--radius-sm)"
              />
            </div>

            <Skeleton
              width="100%"
              height="6px"
              borderRadius="var(--radius-full)"
            />

            <div className="outstanding-skeleton-actions">
              <Skeleton
                width="100%"
                height="44px"
                borderRadius="var(--radius-md)"
              />
              <Skeleton
                width="100%"
                height="44px"
                borderRadius="var(--radius-md)"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
