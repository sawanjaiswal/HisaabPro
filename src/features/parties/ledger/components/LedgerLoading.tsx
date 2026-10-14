/** Ledger — Loading skeleton */

import { Skeleton } from '@/components/feedback/Skeleton'

export function LedgerLoading() {
  return (
    <div aria-busy="true" aria-label="Loading ledger" role="status">
      <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
      <div className="mt-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="mb-2">
            <Skeleton height="3rem" borderRadius="var(--radius-sm)" />
          </div>
        ))}
      </div>
    </div>
  )
}
