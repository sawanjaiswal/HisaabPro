/** Payment History — Empty states (no data at all, or filters returned nothing) */

import { Banknote } from 'lucide-react'
import type { PaymentHistoryFilters } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'

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
    return (
      <EmptyState
        icon={<Banknote size={22} aria-hidden="true" />}
        title="No payments match your filters."
        description={t.tryBroaderDateRange}
        action={
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
        }
      />
    )
  }

  return (
    <EmptyState
      icon={<Banknote size={22} aria-hidden="true" />}
      title={t.noPaymentsRecordedYet}
      description={t.recordFirstPayment}
      action={
        <button
          className="report-load-more-btn"
          onClick={onNavigateNew}
          type="button"
          aria-label={t.recordNewPayment}
        >
          Record Payment
        </button>
      }
    />
  )
}
