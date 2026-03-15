/** Loading skeleton for the template gallery — 4 cards in a 2-column grid */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

const SKELETON_CARD_COUNT = 4

export const TemplateGallerySkeleton: React.FC = () => {
  return (
    <div className="template-gallery" aria-busy="true" aria-label="Loading templates">
      <div className="template-section">
        <Skeleton width="120px" height="0.75rem" borderRadius="var(--radius-sm)" />

        <div className="template-grid">
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
            <div
              key={`template-skeleton-${i}`}
              className="template-card"
              aria-hidden="true"
              style={{ pointerEvents: 'none' }}
            >
              {/* Preview area */}
              <Skeleton
                width="100%"
                height="140px"
                borderRadius="0"
              />

              {/* Info area */}
              <div className="template-card-info">
                <Skeleton width="80%" height="0.875rem" borderRadius="var(--radius-sm)" />
                <Skeleton width="50%" height="0.625rem" borderRadius="var(--radius-full)" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
