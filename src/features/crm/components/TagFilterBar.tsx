/**
 * CRM (#127) — TagFilterBar.
 *
 * Horizontally-scrolling chip strip backed by `useTagSummary`. Selecting a
 * chip narrows GET /api/parties via `?tag=<value>` (single-tag AND). The
 * "All" chip clears the filter; "Untagged" is a UI-only hint (no server
 * support yet — disabled to be honest about it).
 *
 * Loading state: shimmer pills (3 placeholders).
 * Error state: tiny inline retry — full ErrorState would dwarf the bar.
 * Empty state: hidden — when there are no tags the bar adds noise.
 * Success state: chips + the selected count.
 *
 * 44px tap targets enforced via min-h on every chip.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { useTagSummary } from '../hooks/useTagSummary'
import { Button } from '@/components/ui/Button'

interface TagFilterBarProps {
  /** Currently active tag (empty string = "All"). */
  activeTag: string
  /** Called when a chip is tapped. Pass '' to clear. */
  onTagChange: (tag: string) => void
}

export function TagFilterBar({ activeTag, onTagChange }: TagFilterBarProps) {
  const { t } = useLanguage()
  const { data, isLoading, isError, refetch } = useTagSummary()

  // Loading — three shimmer pills
  if (isLoading) {
    return (
      <div className="tag-filter-bar" role="status" aria-label={t.crmTagFilter}>
        {[0, 1, 2].map((i) => (
          <span key={`tag-skel-${i}`} className="tag-chip tag-chip--skeleton" aria-hidden="true" />
        ))}
      </div>
    )
  }

  // Error — inline retry
  if (isError) {
    return (
      <div className="tag-filter-bar tag-filter-bar--error" role="alert">
        <Button variant="none"
          type="button"
          className="tag-chip tag-chip--retry"
          onClick={refetch}
          aria-label={t.crmFollowUpsRetry}
        >
          {t.crmFollowUpsRetry}
        </Button>
      </div>
    )
  }

  // Empty — no tags exist for this tenant. Hide the bar entirely.
  if (!data || data.tags.length === 0) return null

  return (
    <div className="tag-filter-bar" role="tablist" aria-label={t.crmTagFilter}>
      <Button variant="none"
        type="button"
        role="tab"
        aria-selected={activeTag === ''}
        className={`tag-chip${activeTag === '' ? ' tag-chip--active' : ''}`}
        onClick={() => onTagChange('')}
      >
        {t.crmTagAllParties}
      </Button>
      {data.tags.map((tg) => (
        <Button variant="none"
          key={tg.tag}
          type="button"
          role="tab"
          aria-selected={activeTag === tg.tag}
          className={`tag-chip${activeTag === tg.tag ? ' tag-chip--active' : ''}`}
          onClick={() => onTagChange(tg.tag)}
        >
          <span className="tag-chip__label">{tg.tag}</span>
          <span className="tag-chip__count" aria-hidden="true">
            {tg.partyCount}
          </span>
        </Button>
      ))}
    </div>
  )
}
