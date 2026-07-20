/** Segmented filter chip row (hp-design archetype C).
 *
 * Every list screen in the GPT set opens with the same control: a horizontally
 * scrollable row of pills where the active one is filled brand emerald. Each
 * feature used to hand-roll it in its own CSS, which is why the pills drifted
 * apart. One primitive now owns the shape.
 */

import './filter-chips.css'

export interface FilterChipOption<T extends string> {
  value: T
  label: string
  /** Optional trailing count, e.g. "Low 4". */
  count?: number
}

interface FilterChipsProps<T extends string> {
  options: FilterChipOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Describes the group for screen readers, e.g. "Filter stock alerts". */
  label: string
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: FilterChipsProps<T>) {
  return (
    <div className="filter-chips" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={`filter-chip${active ? ' filter-chip--active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="filter-chip-count tabular-nums">{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
