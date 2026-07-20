/** Receivables — skeleton loader: total card + 5 party rows (mockup #17). */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

const ROW_COUNT = 5

export const OutstandingSkeleton: React.FC = () => {
  const { t } = useLanguage()
  return (
    <div role="status" aria-label={t.loadingOutstanding}>
      <div className="outstanding-skeleton" aria-hidden="true">
        {Array.from({ length: ROW_COUNT }, (_, i) => (
          <div key={`skeleton-outstanding-${i}`} className="outstanding-skeleton-row">
            <Skeleton width="44px" height="44px" borderRadius="var(--radius-full)" />
            <div className="outstanding-skeleton-content">
              <Skeleton width="140px" height="14px" />
              <Skeleton width="90px" height="12px" />
            </div>
            <Skeleton width="72px" height="1rem" borderRadius="var(--radius-sm)" />
          </div>
        ))}
      </div>
    </div>
  )
}
