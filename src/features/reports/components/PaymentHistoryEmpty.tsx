/** Payment History — Empty states (no data at all, or filters returned nothing) */

import { Banknote } from 'lucide-react'
import type { PaymentHistoryFilters } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

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
  const { t } = useLanguage()
    if (hasFiltersApplied) {
  const { t } = useLanguage()
    return (
      <div className="report-empty">
        <div className="report-empty-icon" aria-hidden="true">
          <Banknote size={28} />
        </div>
        <p className="report-empty-title">
          No payments match your filters.
        </p>
        <p className="report-empty-desc">
          {t.tryBroaderDateRange}
        </p>
        <button
          className="report-load-more-btn"
          onClick={() => {
            setFilter('type', undefined)
            setFilter('mode', undefined)
          }}
          type="button"
          aria-label={t.clearFilters}
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
      <p className="report-empty-title">{t.noPaymentsRecordedYet}</p>
      <p className="report-empty-desc">
        {t.recordFirstPayment}
      </p>
      <button
        className="report-load-more-btn"
        onClick={onNavigateNew}
        type="button"
        aria-label={t.recordNewPayment}
      >
        Record Payment
      </button>
    </div>
  )
}
