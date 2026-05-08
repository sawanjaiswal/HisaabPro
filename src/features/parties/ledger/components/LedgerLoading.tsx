/** Ledger — Loading skeleton */

import { Skeleton } from '@/components/feedback/Skeleton'

export function LedgerLoading() {
  return (
    <div aria-busy="true" aria-label="Loading ledger" role="status">
      <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
      <div style={{ marginTop: 'var(--space-3)' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} style={{ marginBottom: 'var(--space-2)' }}>
            <Skeleton height="3rem" borderRadius="var(--radius-sm)" />
          </div>
        ))}
      </div>
    </div>
  )
}
