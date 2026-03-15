/** Invoice list loading state — 6 shimmer rows */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

const SKELETON_COUNT = 6

export const InvoiceListSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading invoices">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={`skeleton-invoice-${i}`}
          className="txn-row"
          style={{ minHeight: '44px', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />

          <div className="txn-info" style={{ gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Skeleton width="130px" height="1rem" />
              <Skeleton width="48px" height="1rem" borderRadius="var(--radius-full)" />
            </div>
            <Skeleton width="110px" height="0.75rem" />
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
            <Skeleton width="72px" height="1rem" />
            <Skeleton width="52px" height="0.75rem" borderRadius="var(--radius-full)" />
          </div>
        </div>
      ))}
    </div>
  )
}
