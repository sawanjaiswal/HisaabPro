import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface PartyListLoadMoreProps {
  /** Server reports pages the user has not loaded yet. */
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
}

/**
 * Pager for the parties list. Renders nothing when everything already fits, so
 * Raju (eight parties) never sees a control that would do nothing — while Priya
 * and Amit, who have hundreds, can still reach party 21.
 */
export function PartyListLoadMore({ hasMore, isLoading, onLoadMore }: PartyListLoadMoreProps) {
  const { t } = useLanguage()
  if (!hasMore) return null

  return (
    <Button
      variant="ghost" size="md" className="party-list-load-more"
      onClick={onLoadMore}
      disabled={isLoading}
      aria-label={t.loadMoreParties}
    >
      {isLoading ? t.loading : (
        <>
          {t.loadMore2}
          <ChevronDown size={16} aria-hidden="true" />
        </>
      )}
    </Button>
  )
}
