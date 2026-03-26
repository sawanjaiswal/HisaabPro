/** Report Load More
 *
 * Renders a centred "Load More" button when there are additional pages.
 * Shows a disabled loading state while the next page is being fetched.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

interface ReportLoadMoreProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
}

export const ReportLoadMore: React.FC<ReportLoadMoreProps> = ({
  hasMore,
  isLoading,
  onLoadMore,
}) => {
  const { t } = useLanguage()
  if (!hasMore) return null

  return (
    <div className="report-load-more">
      <button
        className="report-load-more-btn"
        onClick={onLoadMore}
        disabled={isLoading}
        aria-label={isLoading ? t.loadingMoreResults : t.loadMoreResults}
        type="button"
      >
        {isLoading ? t.loading : t.loadMore}
      </button>
    </div>
  )
}
