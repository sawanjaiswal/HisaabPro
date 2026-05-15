/** Sales list loading state — shimmer rows. */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

const SKELETON_COUNT = 5

export const DocumentListSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading documents">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <div
        key={`skel-${i}`}
        className="txn-row"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />
        <div className="txn-info">
          <div className="invoice-card-header">
            <Skeleton width="130px" height="1rem" />
            <Skeleton width="48px" height="1rem" borderRadius="var(--radius-full)" />
          </div>
          <Skeleton width="110px" height="0.75rem" />
        </div>
        <div className="invoice-card-right">
          <Skeleton width="72px" height="1rem" />
          <Skeleton width="52px" height="0.75rem" borderRadius="var(--radius-full)" />
        </div>
      </div>
    ))}
  </div>
)
