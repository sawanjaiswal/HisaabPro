/** Report Group Header
 *
 * Collapsible section header for grouped report views (by month, party, etc.).
 * The chevron icon rotates to indicate expanded/collapsed state.
 */

import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface ReportGroupHeaderProps {
  /** Primary group label, e.g. "March 2026" */
  label: string
  /** Secondary info, e.g. "45 invoices · Rs 3,45,000" */
  subtitle?: string
  isExpanded: boolean
  onToggle: () => void
}

export const ReportGroupHeader: React.FC<ReportGroupHeaderProps> = ({
  label,
  subtitle,
  isExpanded,
  onToggle,
}) => {
  const { t } = useLanguage()
  return (
    <button
      className="report-group-header"
      onClick={onToggle}
      aria-expanded={isExpanded}
      aria-label={`${label}${subtitle ? ` — ${subtitle}` : ''}. ${isExpanded ? t.collapseGroup : t.expandGroup} group.`}
      type="button"
    >
      <div>
        <span className="report-group-label">{label}</span>
        {subtitle !== undefined && subtitle !== '' && (
          <span className="report-group-count">{subtitle}</span>
        )}
      </div>
      <ChevronDown
        size={18}
        aria-hidden="true"
        className={`report-group-chevron${isExpanded ? ' report-group-chevron--open' : ''}`}
      />
    </button>
  )
}
