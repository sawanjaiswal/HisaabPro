/** Dashboard — Loading skeleton
 *
 * Mirrors the layout of the loaded dashboard so there is no layout shift.
 * Uses .dashboard-skeleton-* classes from dashboard.css (shimmer animation).
 * No props — purely presentational.
 */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="dashboard-page" aria-busy="true" aria-label="Loading dashboard">

      {/* Range pills skeleton */}
      <div className="dashboard-range-bar" aria-hidden="true">
        <Skeleton width="72px" height="44px" borderRadius="var(--radius-full)" />
        <Skeleton width="88px" height="44px" borderRadius="var(--radius-full)" />
        <Skeleton width="100px" height="44px" borderRadius="var(--radius-full)" />
        <Skeleton width="72px" height="44px" borderRadius="var(--radius-full)" />
      </div>

      {/* Quick actions skeleton */}
      <div className="dashboard-quick-actions" aria-hidden="true">
        <Skeleton width="128px" height="44px" borderRadius="var(--radius-full)" />
        <Skeleton width="148px" height="44px" borderRadius="var(--radius-full)" />
        <Skeleton width="120px" height="44px" borderRadius="var(--radius-full)" />
        <Skeleton width="112px" height="44px" borderRadius="var(--radius-full)" />
      </div>

      {/* 2×2 stat cards skeleton */}
      <div className="dashboard-stats-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={`stat-skeleton-${i}`}
            className="dashboard-stat-card dashboard-stat-card--skeleton"
          >
            <div className="dashboard-stat-header">
              <div className="dashboard-skeleton-line dashboard-skeleton-sub" style={{ width: '60%' }} />
              <div className="dashboard-skeleton-line dashboard-skeleton-icon" />
            </div>
            <div className="dashboard-skeleton-line dashboard-skeleton-amount" />
            <div className="dashboard-skeleton-line dashboard-skeleton-sub" />
          </div>
        ))}
      </div>

      {/* Cash flow strip skeleton */}
      <div className="dashboard-cashflow" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={`cashflow-skeleton-${i}`} className="dashboard-cashflow-item">
            <Skeleton width="60%" height="10px" />
            <Skeleton width="80%" height="20px" />
          </div>
        ))}
      </div>

      {/* Outstanding list skeleton */}
      <div className="dashboard-outstanding-card" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`outstanding-skeleton-${i}`} className="dashboard-outstanding-row" style={{ cursor: 'default' }}>
            <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />
            <div className="dashboard-outstanding-info">
              <Skeleton width="55%" height="15px" />
              <Skeleton width="35%" height="11px" />
            </div>
            <div className="dashboard-outstanding-right">
              <Skeleton width="64px" height="15px" />
              <Skeleton width="56px" height="18px" borderRadius="var(--radius-full)" />
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
