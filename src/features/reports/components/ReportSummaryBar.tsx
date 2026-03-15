/** Report Summary Bar
 *
 * Generic horizontal-scroll row of metric cards shown below the filter bar
 * on every report screen.
 */

import React from 'react'

interface SummaryItem {
  label: string
  value: string
  /** CSS variable string, e.g. "var(--color-success-600)" */
  color?: string
}

interface ReportSummaryBarProps {
  items: SummaryItem[]
}

export const ReportSummaryBar: React.FC<ReportSummaryBarProps> = ({ items }) => {
  return (
    <div className="report-summary-bar" role="region" aria-label="Report summary">
      {items.map((item) => (
        <div key={item.label} className="report-summary-item">
          <span className="report-summary-label">{item.label}</span>
          <span
            className="report-summary-value"
            style={item.color ? { color: item.color } : undefined}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}
