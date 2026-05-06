/**
 * AgingLoadingSkeleton — shimmer layout matching the premium card shapes.
 */

import '../styles/aging.css'

export function AgingLoadingSkeleton() {
  return (
    <div className="aging-skeleton" aria-busy="true" aria-label="Loading aging data">
      {/* Total strip shimmer — card-shaped */}
      <div className="skeleton-block skeleton-strip" />

      {/* 2×2 bucket grid shimmer */}
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-block skeleton-tile" />
        ))}
      </div>

      {/* Top parties section shimmer */}
      <div className="skeleton-party-section">
        <div className="skeleton-block skeleton-party-label" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-block skeleton-row" />
        ))}
      </div>
    </div>
  )
}
