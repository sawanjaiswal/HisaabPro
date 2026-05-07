/** Cash Register — Direction filter pills + sort dropdown */

import type { CashHistoryFilter, CashHistorySort, CashEntryDirection } from '../cashRegister.types'

interface Props {
  filter: CashHistoryFilter
  sort: CashHistorySort
  onFilterChange: (f: CashHistoryFilter) => void
  onSortChange: (s: CashHistorySort) => void
}

type DirectionOption = { value: CashEntryDirection | undefined; label: string }

const DIRECTION_OPTIONS: DirectionOption[] = [
  { value: undefined,  label: 'All' },
  { value: 'IN',       label: 'In' },
  { value: 'OUT',      label: 'Out' },
]

export function HistoryControls({ filter, sort, onFilterChange, onSortChange }: Props) {
  return (
    <div className="cr-controls">
      {/* Direction filter pills */}
      <div className="cr-controls__pills" role="group" aria-label="Filter by direction">
        {DIRECTION_OPTIONS.map((opt) => {
          const isActive = filter.direction === opt.value
          return (
            <button
              key={opt.label}
              type="button"
              className={`cr-controls__pill${isActive ? ' cr-controls__pill--active' : ''}`}
              onClick={() => onFilterChange({ ...filter, direction: opt.value })}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          )
        })}

        {/* Voided toggle */}
        <button
          type="button"
          className={`cr-controls__pill${filter.includeVoided ? ' cr-controls__pill--active' : ''}`}
          onClick={() => onFilterChange({ ...filter, includeVoided: !filter.includeVoided })}
          aria-pressed={filter.includeVoided}
        >
          {filter.includeVoided ? 'Hide Voided' : 'Show Voided'}
        </button>
      </div>

      {/* Sort dropdown */}
      <div className="cr-controls__sort">
        <label htmlFor="cr-sort" className="cr-controls__sort-label">Sort</label>
        <select
          id="cr-sort"
          className="cr-controls__sort-select"
          value={sort.by}
          onChange={(e) => onSortChange({ by: e.target.value as CashHistorySort['by'] })}
          aria-label="Sort entries"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest</option>
          <option value="lowest">Lowest</option>
        </select>
      </div>
    </div>
  )
}
