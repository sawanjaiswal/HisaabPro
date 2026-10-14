/** Payment Detail — Loading skeleton sub-component
 *
 * Renders placeholder shapes matching the hero card,
 * pill tabs, and content area layout.
 */

import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/feedback/Skeleton'

export function PaymentDetailSkeleton() {
  return (
    <>
      <Card className="mb-4 min-h-[160px] p-4">
        <Skeleton height="1.5rem" width="60%" />
        <div className="mt-3">
          <Skeleton height="1rem" width="40%" />
        </div>
        <div className="mt-4">
          <Skeleton height="2.5rem" width="50%" />
        </div>
      </Card>
      <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
      <div className="mt-4">
        <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
      </div>
    </>
  )
}
