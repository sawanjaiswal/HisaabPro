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
          style={{ minHeight: '44px', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <Skeleton
            width="44px"
            height="44px"
            borderRadius="50%"
          />

          <div className="txn-info" style={{ gap: 'var(--space-2)' }}>
            <Skeleton width="140px" height="1rem" />
            <Skeleton width="100px" height="0.75rem" />
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <Skeleton width="72px" height="1rem" />
          </div>
        </div>
      ))}
    </div>
  )
}
