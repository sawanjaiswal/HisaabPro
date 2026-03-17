/** Payment History — Empty states (no data at all, or filters returned nothing) */

import { Banknote } from 'lucide-react'
import type { PaymentHistoryFilters } from '../report.types'

interface PaymentHistoryEmptyProps {
  hasFiltersApplied: boolean
  onNavigateNew: () => void
  setFilter: <K extends keyof PaymentHistoryFilters>(
    key: K,
    value: PaymentHistoryFilters[K],
  ) => void
}

export function PaymentHistoryEmpty({
  hasFiltersApplied,
  onNavigateNew,
  setFilter,
}: PaymentHistoryEmptyProps) {
  if (hasFiltersApplied) {
    return (
      <div className="report-empty">
        <div className="report-empty-icon" aria-hidden="true">
          <Banknote size={28} />
        </div>
        <p className="report-empty-title">
          No payments match your filters.
        </p>
        <p className="report-empty-desc">
          Try a broader date range or clear the active filters.
        </p>
        <button
          className="report-load-more-btn"
          onClick={() => {
            setFilter('type', undefined)
            setFilter('mode', undefined)
          }}
          type="button"
          aria-label="Clear filters"
        >
          Clear Filters
        </button>
      </div>
    )
  }

  return (
    <div className="report-empty">
      <div className="report-empty-icon" aria-hidden="true">
        <Banknote size={28} />
      </div>
      <p className="report-empty-title">No payments recorded yet.</p>
      <p className="report-empty-desc">
        Record your first payment to start tracking cash flow.
      </p>
      <button
        className="report-load-more-btn"
        onClick={onNavigateNew}
        type="button"
        aria-label="Record a new payment"
      >
        Record Payment
      </button>
    </div>
  )
}
