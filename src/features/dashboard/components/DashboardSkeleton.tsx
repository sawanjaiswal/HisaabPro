/** Dashboard — Loading skeleton (matches Figma layout)
 *
 * Mirrors the layout of the loaded dashboard so there is no layout shift.
 */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

export const DashboardSkeleton: React.FC = () => {
  const { t } = useLanguage()
  return (
    <>
      {/* Top gradient section */}
      <div className="dashboard-top-section py-0" aria-busy="true" aria-label={t.loadingDashboard}>
        {/* Greeting skeleton */}
        <div className="dashboard-greeting-row" aria-hidden="true">
          <div className="flex flex-col gap-2">
            <Skeleton width="160px" height="20px" />
            <Skeleton width="200px" height="14px" />
          </div>
          <Skeleton width="90px" height="28px" borderRadius="9999px" />
        </div>

        {/* Sales hero skeleton */}
        <div className="dashboard-sales-hero" aria-hidden="true">
          <Skeleton width="80px" height="13px" />
          <Skeleton width="160px" height="32px" />
        </div>

        {/* Stats grid skeleton */}
        <div className="dashboard-stats-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={`stat-skeleton-${i}`} className="dashboard-stat-tile flex flex-col gap-2">
              <Skeleton width="28px" height="28px" borderRadius="9999px" />
              <Skeleton width="60%" height="18px" />
              <Skeleton width="40%" height="11px" />
            </div>
          ))}
        </div>

        {/* Top priorities skeleton */}
        <div className="dashboard-priorities-card" aria-hidden="true">
          <Skeleton width="120px" height="17px" />
          {Array.from({ length: 2 }, (_, i) => (
            <div key={`priority-skeleton-${i}`} className="flex items-center gap-3 py-2">
              <Skeleton width="36px" height="36px" borderRadius="9999px" />
              <div className="flex-1 flex flex-col gap-1">
                <Skeleton width="70%" height="14px" />
                <Skeleton width="50%" height="12px" />
              </div>
              <Skeleton width="76px" height="32px" borderRadius="8px" />
            </div>
          ))}
        </div>

        {/* Action grid skeleton */}
        <div className="dashboard-action-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={`action-skeleton-${i}`} className="dashboard-action-item cursor-default">
              <Skeleton width="56px" height="56px" borderRadius="18px" />
              <Skeleton width="40px" height="12px" />
            </div>
          ))}
        </div>
      </div>

      {/* White section skeleton */}
      <div className="dashboard-white-section dashboard-white-section--no-alerts py-0" aria-hidden="true">
        {/* Starred skeleton */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <Skeleton width="60px" height="17px" />
            <Skeleton width="50px" height="13px" />
          </div>
          <div className="flex gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={`starred-skeleton-${i}`} className="flex flex-col items-center gap-2">
                <Skeleton width="56px" height="56px" borderRadius="9999px" />
                <Skeleton width="36px" height="12px" />
              </div>
            ))}
          </div>
        </div>

        {/* Transactions skeleton */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <Skeleton width="140px" height="16px" />
            <Skeleton width="50px" height="13px" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`txn-skeleton-${i}`} className="flex items-center gap-4 py-3">
              <Skeleton width="32px" height="32px" borderRadius="9999px" />
              <div className="flex-1 flex flex-col gap-1">
                <Skeleton width="70%" height="16px" />
                <Skeleton width="50%" height="14px" />
              </div>
              <div className="flex flex-col items-end gap-1">
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
