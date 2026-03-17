import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

const SKELETON_COUNT = 6

export const PartyListSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading parties">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={`skeleton-party-${i}`}
          className="txn-row"
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <Skeleton
            width="44px"
            height="44px"
            borderRadius="50%"
          />

          <div className="txn-info">
            <div className="party-card-header">
              <Skeleton width="140px" height="1rem" />
              <Skeleton width="60px" height="0.875rem" borderRadius="var(--radius-full)" />
            </div>
            <Skeleton width="100px" height="0.75rem" />
          </div>

          <div className="party-card-right">
            <Skeleton width="72px" height="1rem" />
          </div>
        </div>
      ))}
    </div>
  )
}
