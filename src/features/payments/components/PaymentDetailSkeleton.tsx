/** Payment Detail — Loading skeleton sub-component
 *
 * Renders placeholder shapes matching the hero card,
 * pill tabs, and content area layout.
 */

import { Skeleton } from '@/components/feedback/Skeleton'

export function PaymentDetailSkeleton() {
  return (
    <>
      <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 160 }}>
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
}
