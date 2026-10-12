/**
 * Party Ledger — toolbar: search · filter · month.
 *
 * Split out of `PartyLedgerTab` so that file stays under the 250-line ratchet
 * and the tab keeps only data orchestration. Search is client-side over rows
 * already in hand (see `filterRowsByQuery`) — it costs no request and works
 * offline, so it is safe to keep always-visible rather than behind a toggle.
 *
 * PDF export moved into the filter drawer: three icons plus a search field do
 * not fit at 320px, and export is a once-in-a-while action, not a per-view one.
 */

import { ListFilter } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'

interface LedgerToolbarProps {
  query: string
  onQueryChange: (next: string) => void
  from?: string
  to?: string
  onMonthChange?: (from: string, to: string) => void
  /** Hidden on the Invoices/Payments tabs, where the type filter is fixed. */
  showFilter?: boolean
  filterCount: number
  onOpenFilter: () => void
}

export function LedgerToolbar({
  query,
  onQueryChange,
  filterCount,
  onOpenFilter,
}: LedgerToolbarProps) {
  const { t } = useLanguage()

  return (
    <div className="ledger-toolbar">
      <div className="ledger-search-wrap">
        <SearchInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onClear={() => onQueryChange('')}
          placeholder={t.searchTransactions}
          ariaLabel={t.searchTransactions}
        />
      </div>

      <div className="ledger-toolbar__actions">
        <Button
          variant="none"
          type="button"
          className={`ledger-filter-btn${filterCount > 0 ? ' ledger-filter-btn--active' : ''}`}
          onClick={onOpenFilter}
          aria-label={t.filter}
          title={t.filter}
        >
          <ListFilter size={18} strokeWidth={2.2} aria-hidden="true" />
          {filterCount > 0 && <span className="ledger-filter-badge">{filterCount}</span>}
        </Button>
      </div>
    </div>
  )
}
