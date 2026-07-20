/** Party detail loading skeleton — hero card + tabs + info rows placeholder.
 * Mirrors the InvoiceDetailSkeleton / PaymentDetailSkeleton sibling pattern.
 */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

export const PartyDetailSkeleton: React.FC = () => (
  <>
    <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 140 }}>
      <Skeleton height="1.5rem" width="60%" />
      <div style={{ marginTop: 'var(--space-3)' }}>
        <Skeleton height="1rem" width="40%" />
      </div>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <Skeleton height="2.5rem" width="50%" />
      </div>
    </div>
    <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
    <div style={{ marginTop: 'var(--space-4)' }}>
      <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
    </div>
  </>
)
