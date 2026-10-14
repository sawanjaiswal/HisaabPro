/** Party detail loading skeleton — stat strip · action row · tabs · rows.
 *
 * Shaped like what actually lands (4-column strip, 3-slot action row) so the
 * page does not visibly re-flow when data arrives. The overdue banner is
 * deliberately absent: most parties have nothing overdue, and a placeholder
 * for a block that usually never renders reads as a broken load.
 */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

export const PartyDetailSkeleton: React.FC = () => (
  <>
    {/* 4-column stat strip */}
    <div className="flex gap-3 mb-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex-1 min-w-0">
          <Skeleton height="0.75rem" width="80%" />
          <div className="mt-2">
            <Skeleton height="1.25rem" width="90%" />
          </div>
        </div>
      ))}
    </div>

    {/* Action row: two CTAs + the ⋯ square */}
    <div className="flex gap-2 mb-4">
      <div className="flex-1">
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
      </div>
      <div className="flex-1">
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
      </div>
      <div className="w-11 flex-shrink-0">
        <Skeleton height="44px" borderRadius="var(--radius-sm)" />
      </div>
    </div>

    <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
    <div className="mt-4">
      <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
    </div>
  </>
)
