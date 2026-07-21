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

import { Filter, Search, Calendar } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LedgerMonthPicker } from './LedgerMonthPicker'

interface LedgerToolbarProps {
  query: string
  onQueryChange: (next: string) => void
  from: string
  to: string
  onMonthChange: (from: string, to: string) => void
  /** Hidden on the Invoices/Payments tabs, where the type filter is fixed. */
  showFilter: boolean
  filterCount: number
  onOpenFilter: () => void
}

export function LedgerToolbar({
  query,
  onQueryChange,
  from,
  to,
  onMonthChange,
  showFilter,
  filterCount,
  onOpenFilter,
}: LedgerToolbarProps) {
  const { t } = useLanguage()

  return (
    <div className="ledger-toolbar">
      <Input
        type="search"
        className="ledger-search"
        icon={<Search size={16} />}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t.searchTransactions}
        aria-label={t.searchTransactions}
      />

      <div className="ledger-toolbar__actions">
        {showFilter && (
          <Button
            variant="none"
            type="button"
            className="ledger-filter-btn"
            onClick={onOpenFilter}
            aria-label={t.filter}
          >
            <Filter size={16} aria-hidden="true" />
            {filterCount > 0 && <span className="ledger-filter-badge">{filterCount}</span>}
          </Button>
        )}

        <div className="ledger-toolbar__month">
          <Calendar size={16} className="ledger-toolbar__month-icon" aria-hidden="true" />
          <LedgerMonthPicker from={from} to={to} onChange={onMonthChange} />
        </div>
      </div>
    </div>
  )
}
