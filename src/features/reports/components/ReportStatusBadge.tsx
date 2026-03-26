/** Report Status Badge
 *
 * Generic pill badge for invoice status (paid/unpaid/partial), stock status,
 * and any other labelled state. The `color` prop is a CSS variable string;
 * the 10% background tint is applied via CSS custom property injection.
 */

import React from 'react'

interface ReportStatusBadgeProps {
  /** The value used as a CSS modifier, e.g. "paid" → ".report-status-badge--paid" */
  status: string
  /** Display label inside the badge */
  label: string
  /**
   * CSS variable string for the badge text color, e.g. "var(--color-success-600)".
   * When a matching CSS modifier class exists it takes precedence — this prop
   * is used as a fallback for dynamic / non-enumerated statuses.
   */
  color: string
}

export const ReportStatusBadge: React.FC<ReportStatusBadgeProps> = ({
  status,
  label,
  color,
}) => {
  const modifier = status.toLowerCase().replace(/_/g, '-')
  const modifierClass = `report-status-badge--${modifier}`

  return (
    <span
      className={`report-status-badge ${modifierClass}`}
      style={{ color }}
      aria-label={label}
    >
      {label}
    </span>
  )
}
