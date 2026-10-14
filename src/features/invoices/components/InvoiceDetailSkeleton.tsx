/** Invoice Detail — loading-state skeleton. */

import { Skeleton } from '@/components/feedback/Skeleton'
import { Card } from '@/components/ui/Card'

export function InvoiceDetailSkeleton() {
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
