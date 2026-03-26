/** Report Skeleton
 *
 * Generic loading skeleton shown while any report screen fetches its first page.
 * Renders a summary bar skeleton + N row skeletons to preserve layout stability.
 */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

interface ReportSkeletonProps {
  /** Number of row skeletons to render. Defaults to 5. */
  rows?: number
}

export const ReportSkeleton: React.FC<ReportSkeletonProps> = ({rows = 5 }) => {
  const { t } = useLanguage()
    return (
    <div aria-label={t.loadingReport} aria-busy="true">
      {/* Summary bar skeleton — 4 metric card placeholders */}
      <div className="report-summary-bar" aria-hidden="true">
        <div className="report-summary-item">
          <Skeleton width="60px" height="0.75rem" />
          <Skeleton width="90px" height="1rem" />
        </div>
        <div className="report-summary-item">
          <Skeleton width="60px" height="0.75rem" />
          <Skeleton width="90px" height="1rem" />
        </div>
        <div className="report-summary-item">
          <Skeleton width="60px" height="0.75rem" />
          <Skeleton width="90px" height="1rem" />
        </div>
        <div className="report-summary-item">
          <Skeleton width="60px" height="0.75rem" />
          <Skeleton width="90px" height="1rem" />
        </div>
      </div>

      {/* Row skeletons */}
      <div className="report-card-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={`row-skeleton-${i}`} className="report-card">
            <div className="report-card-header">
              <Skeleton width="100px" height="0.9375rem" />
              <Skeleton width="70px" height="0.8125rem" />
            </div>
            <div className="report-card-body">
              <Skeleton width="140px" height="0.875rem" />
              <Skeleton width="60px" height="0.75rem" />
            </div>
            <div className="report-card-footer">
              <Skeleton width="90px" height="0.9375rem" />
              <Skeleton width="56px" height="1.25rem" borderRadius="var(--radius-full)" />
            </div>
            <div className="report-divider" />
          </div>
        ))}
      </div>
    </div>
  )
}
