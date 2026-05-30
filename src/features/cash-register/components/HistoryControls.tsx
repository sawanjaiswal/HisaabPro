/** Cash Register — Direction filter pills + sort dropdown */

import type { CashHistoryFilter, CashHistorySort, CashEntryDirection } from '../cashRegister.types'
import { Select, SelectItem } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

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
            <Button variant="none"
              key={opt.label}
              type="button"
              className={`cr-controls__pill${isActive ? ' cr-controls__pill--active' : ''}`}
              onClick={() => onFilterChange({ ...filter, direction: opt.value })}
              aria-pressed={isActive}
            >
              {opt.label}
            </Button>
          )
        })}

        {/* Voided toggle */}
        <Button variant="none"
          type="button"
          className={`cr-controls__pill${filter.includeVoided ? ' cr-controls__pill--active' : ''}`}
          onClick={() => onFilterChange({ ...filter, includeVoided: !filter.includeVoided })}
          aria-pressed={filter.includeVoided}
        >
          {filter.includeVoided ? 'Hide Voided' : 'Show Voided'}
        </Button>
      </div>

      {/* Sort dropdown */}
      <div className="cr-controls__sort">
        <label className="cr-controls__sort-label">Sort</label>
        <Select
          value={sort.by}
          onValueChange={(v) => onSortChange({ by: v as CashHistorySort['by'] })}
          ariaLabel="Sort entries"
        >
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="highest">Highest</SelectItem>
          <SelectItem value="lowest">Lowest</SelectItem>
        </Select>
      </div>
    </div>
  )
}
