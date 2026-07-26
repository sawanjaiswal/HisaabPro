import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import './list-load-more.css'

interface ListLoadMoreProps {
  /** Server reports pages the user has not loaded yet. */
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  /** Screen-reader label naming what is being loaded ("Load more parties"). */
  ariaLabel: string
}

/**
 * The pager every paged list uses. Renders nothing when everything already
 * fits, so Raju (eight parties) never sees a control that would do nothing —
 * while Priya and Amit, who have hundreds, can still reach row 21.
 *
 * One component, not one per feature: the parties list and the products list
 * had the identical cap bug (F13, F17) and the identical fix, and the third
 * paged list should import this rather than copy it.
 */
export function ListLoadMore({ hasMore, isLoading, onLoadMore, ariaLabel }: ListLoadMoreProps) {
  const { t } = useLanguage()
  if (!hasMore) return null

  return (
    <Button
      variant="ghost"
      size="md"
      className="list-load-more"
      onClick={onLoadMore}
      disabled={isLoading}
      aria-label={ariaLabel}
    >
      {isLoading ? (
        t.loading
      ) : (
        <>
          {t.loadMore2}
          <ChevronDown size={16} aria-hidden="true" />
        </>
      )}
    </Button>
  )
}
