/** Cash Register — Direction filter pills + sort dropdown */

import type { CashHistoryFilter, CashHistorySort, CashEntryDirection } from '../cashRegister.types'
import { Select, SelectItem } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  filter: CashHistoryFilter
  sort: CashHistorySort
  onFilterChange: (f: CashHistoryFilter) => void
  onSortChange: (s: CashHistorySort) => void
}

type DirectionOption = { value: CashEntryDirection | undefined; label: string }

export function HistoryControls({ filter, sort, onFilterChange, onSortChange }: Props) {
  const { t } = useLanguage()
  const DIRECTION_OPTIONS: DirectionOption[] = [
    { value: undefined,  label: t.cashRegFilterAll },
    { value: 'IN',       label: t.cashRegSummaryIn },
    { value: 'OUT',      label: t.cashRegSummaryOut },
  ]
  return (
    <div className="cr-controls">
      {/* Direction filter pills */}
      <div className="cr-controls__pills" role="group" aria-label={t.cashRegFilterDirAria}>
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
          {filter.includeVoided ? t.cashRegHideVoided : t.cashRegShowVoided}
        </Button>
      </div>

      {/* Sort dropdown */}
      <div className="cr-controls__sort">
        <label className="cr-controls__sort-label">{t.cashRegSortLabel}</label>
        <Select
          value={sort.by}
          onValueChange={(v) => onSortChange({ by: v as CashHistorySort['by'] })}
          ariaLabel={t.cashRegSortAria}
        >
          <SelectItem value="newest">{t.cashRegSortNewest}</SelectItem>
          <SelectItem value="oldest">{t.cashRegSortOldest}</SelectItem>
          <SelectItem value="highest">{t.cashRegSortHighest}</SelectItem>
          <SelectItem value="lowest">{t.cashRegSortLowest}</SelectItem>
        </Select>
      </div>
    </div>
  )
}
