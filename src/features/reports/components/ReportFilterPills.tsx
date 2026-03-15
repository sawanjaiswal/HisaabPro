/** Report Filter Pills
 *
 * Horizontally scrollable pill row used for date presets, status filters,
 * group-by options, and any other single-select categorical filters.
 */

import React from 'react'

interface FilterOption {
  value: string
  label: string
}

interface ReportFilterPillsProps {
  options: FilterOption[]
  activeValue: string
  onChange: (value: string) => void
  /** Accessible group label for screen readers */
  ariaLabel?: string
}

export const ReportFilterPills: React.FC<ReportFilterPillsProps> = ({
  options,
  activeValue,
  onChange,
  ariaLabel = 'Filter options',
}) => {
  return (
    <div
      className="report-filter-pills"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = option.value === activeValue
        return (
          <button
            key={option.value}
            className={`report-filter-pill${isActive ? ' report-filter-pill--active' : ''}`}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            aria-label={option.label}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
