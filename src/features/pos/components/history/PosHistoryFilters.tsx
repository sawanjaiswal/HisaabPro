/** POS — History date/status/payment-mode filters */

import { X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PAYMENT_MODES } from '../../utils/pos.constants'
import type { PosHistoryFilters, PosSaleStatus, PaymentMode } from '../../types/pos.types'
import type { TranslationKey } from '@/lib/translations'

interface PosHistoryFiltersProps {
  filters:        PosHistoryFilters
  onDateRange:    (from?: string, to?: string) => void
  onStatus:       (status: PosSaleStatus | '') => void
  onPaymentMode:  (mode: PaymentMode | '') => void
  onReset:        () => void
}

export function PosHistoryFiltersBar({
  filters,
  onDateRange,
  onStatus,
  onPaymentMode,
  onReset,
}: PosHistoryFiltersProps) {
  const { t } = useLanguage()

  const hasFilters =
    !!filters.from || !!filters.to || !!filters.status || !!filters.paymentMode

  return (
    <div className="pos-history-filters" role="search" aria-label={t.posFilterSales ?? 'Filter sales'}>
      {/* Date range */}
      <div className="pos-filter-row">
        <label className="pos-filter-label" htmlFor="pos-from">
          {t.from ?? 'From'}
        </label>
        <input
          id="pos-from"
          type="date"
          className="pos-filter-input"
          value={filters.from ?? ''}
          onChange={(e) => onDateRange(e.target.value || undefined, filters.to)}
          aria-label={t.from ?? 'From date'}
        />
        <label className="pos-filter-label" htmlFor="pos-to">
          {t.to ?? 'To'}
        </label>
        <input
          id="pos-to"
          type="date"
          className="pos-filter-input"
          value={filters.to ?? ''}
          onChange={(e) => onDateRange(filters.from, e.target.value || undefined)}
          aria-label={t.to ?? 'To date'}
        />
      </div>

      {/* Status + mode */}
      <div className="pos-filter-row">
        <select
          className="pos-filter-select"
          value={filters.status ?? ''}
          onChange={(e) => onStatus(e.target.value as PosSaleStatus | '')}
          aria-label={t.posStatusFilter ?? 'Status'}
        >
          <option value="">{t.allStatuses ?? 'All statuses'}</option>
          <option value="ACTIVE">{t.posStatusActive ?? 'Active'}</option>
          <option value="VOIDED">{t.posVoided ?? 'Voided'}</option>
        </select>

        <select
          className="pos-filter-select"
          value={filters.paymentMode ?? ''}
          onChange={(e) => onPaymentMode(e.target.value as PaymentMode | '')}
          aria-label={t.posPaymentModeFilter ?? 'Payment mode'}
        >
          <option value="">{t.allModes ?? 'All modes'}</option>
          {PAYMENT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {t[m.labelKey as TranslationKey] as string ?? m.value}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            className="pos-filter-reset"
            onClick={onReset}
            aria-label={t.clearFilters ?? 'Clear filters'}
          >
            <X size={13} aria-hidden="true" />
            {t.clearFilters ?? 'Clear'}
          </button>
        )}
      </div>
    </div>
  )
}
