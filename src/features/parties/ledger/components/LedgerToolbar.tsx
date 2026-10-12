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
          variant={filterCount > 0 ? 'primary' : 'outline'}
          size="md"
          type="button"
          className="relative !w-11 !h-11 !p-0 flex items-center justify-center flex-shrink-0"
          onClick={onOpenFilter}
          aria-label={t.filter}
          title={t.filter}
        >
          <ListFilter size={20} strokeWidth={2.2} aria-hidden="true" />
          {filterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary-600)] px-1 text-[10px] font-bold text-white shadow-sm">
              {filterCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
