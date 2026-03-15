/** Dashboard — Date range pill selector
 *
 * Horizontally scrollable pill tabs for Today / This Week / This Month / Custom.
 * Active pill uses solid primary background.
 */

import React from 'react'
import { DASHBOARD_RANGES, DASHBOARD_RANGE_LABELS } from '../dashboard.constants'
import type { DashboardRange } from '../dashboard.types'

interface DashboardDateRangeProps {
  activeRange: DashboardRange
  onRangeChange: (range: DashboardRange) => void
}

export const DashboardDateRange: React.FC<DashboardDateRangeProps> = ({
  activeRange,
  onRangeChange,
}) => {
  return (
    <div
      className="dashboard-range-bar"
      role="tablist"
      aria-label="Date range filter"
    >
      {DASHBOARD_RANGES.map((range) => {
        const isActive = range === activeRange
        return (
          <button
            key={range}
            role="tab"
            aria-selected={isActive}
            className={
              isActive
                ? 'dashboard-range-pill dashboard-range-pill--active'
                : 'dashboard-range-pill'
            }
            onClick={() => onRangeChange(range)}
          >
            {DASHBOARD_RANGE_LABELS[range]}
          </button>
        )
      })}
    </div>
  )
}
