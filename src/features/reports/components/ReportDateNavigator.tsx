/** Report Date Navigator
 *
 * Day Book page heading: prev arrow — date label — next arrow.
 * Next button is disabled when the current date is today (can't navigate forward).
 * The date label is a button to support future date-picker integration.
 */

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface ReportDateNavigatorProps {
  /** ISO date string, e.g. "2026-03-15" */
  date: string
  /** Human-readable label, e.g. "Saturday, 15 March 2026" */
  dayLabel: string
  onPrev: () => void
  onNext: () => void
  /** Pass false when the current date is today — disables the Next button */
  canGoNext: boolean
  /** Optional handler for when the user taps the date label (e.g. open picker) */
  onDateClick?: () => void
}

export const ReportDateNavigator: React.FC<ReportDateNavigatorProps> = ({
  date,
  dayLabel,
  onPrev,
  onNext,
  canGoNext,
  onDateClick,
}) => {
  const { t } = useLanguage()
    return (
    <div className="report-date-nav">
      <button
        className="report-date-nav-btn"
        onClick={onPrev}
        aria-label={t.goToPreviousDay}
        type="button"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>

      <div className="report-date-nav-label">
        <button
          className="report-date-nav-primary"
          onClick={onDateClick}
          aria-label={`${t.currentDate}: ${dayLabel}. ${t.tapToPickDate}`}
          type="button"
          style={onDateClick ? { cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', width: '100%' } : { background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'default', width: '100%' }}
        >
          {dayLabel}
        </button>
        <span className="report-date-nav-secondary">{date}</span>
      </div>

      <button
        className="report-date-nav-btn"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label={t.goToNextDay}
        aria-disabled={!canGoNext}
        type="button"
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
