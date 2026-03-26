/** Report Card List
 *
 * Semantic list wrapper for report row cards. Applies the shared
 * `.report-card-list` layout and exposes the correct ARIA role.
 */

import React from 'react'

interface ReportCardListProps {
  children: React.ReactNode
  /** Accessible label describing what the list contains */
  ariaLabel: string
}

export const ReportCardList: React.FC<ReportCardListProps> = ({
  children,
  ariaLabel,
}) => {
  return (
    <div className="report-card-list" role="list" aria-label={ariaLabel}>
      {children}
    </div>
  )
}
