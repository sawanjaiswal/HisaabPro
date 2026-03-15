/** Dashboard — Loading skeleton (matches Figma layout)
 *
 * Mirrors the layout of the loaded dashboard so there is no layout shift.
 */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'

export const DashboardSkeleton: React.FC = () => {
  return (
    <>
      {/* Top gradient section */}
      <div className="dashboard-top-section" aria-busy="true" aria-label="Loading dashboard">
        {/* Sales hero skeleton */}
        <div className="dashboard-sales-hero" aria-hidden="true">
          <Skeleton width="80px" height="13px" />
          <Skeleton width="160px" height="32px" />
        </div>

        {/* Outstanding hero skeleton */}
        <div className="dashboard-hero" aria-hidden="true">
          <div className="dashboard-hero-card dashboard-hero-card--skeleton" style={{ flexDirection: 'column', gap: '16px' }}>
            <Skeleton width="80%" height="20px" />
            <Skeleton width="60%" height="13px" />
          </div>
          <div className="dashboard-hero-card dashboard-hero-card--skeleton" style={{ flexDirection: 'column', gap: '16px' }}>
            <Skeleton width="80%" height="20px" />
            <Skeleton width="60%" height="13px" />
          </div>
        </div>

        {/* Action grid skeleton */}
        <div className="dashboard-action-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={`action-skeleton-${i}`} className="dashboard-action-item" style={{ cursor: 'default' }}>
              <Skeleton width="56px" height="56px" borderRadius="18px" />
              <Skeleton width="40px" height="12px" />
            </div>
          ))}
        </div>
      </div>

      {/* White section skeleton */}
      <div className="dashboard-white-section dashboard-white-section--no-alerts" aria-hidden="true">
        {/* Starred skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width="60px" height="17px" />
            <Skeleton width="50px" height="13px" />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={`starred-skeleton-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Skeleton width="56px" height="56px" borderRadius="9999px" />
                <Skeleton width="36px" height="12px" />
              </div>
            ))}
          </div>
        </div>

        {/* Transactions skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width="140px" height="16px" />
            <Skeleton width="50px" height="13px" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`txn-skeleton-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
              <Skeleton width="32px" height="32px" borderRadius="9999px" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Skeleton width="70%" height="16px" />
                <Skeleton width="50%" height="14px" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <Skeleton width="56px" height="14px" />
                <Skeleton width="44px" height="12px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
