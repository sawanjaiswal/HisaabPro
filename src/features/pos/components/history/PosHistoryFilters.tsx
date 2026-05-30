/** POS — History date/status/payment-mode filters */

import { X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
import { PAYMENT_MODES } from '../../utils/pos.constants'

const ALL = '__all__' as const
import type { PosHistoryFilters, PosSaleStatus, PaymentMode } from '../../types/pos.types'
import type { TranslationKey } from '@/lib/translations'
import { Input } from '@/components/ui/Input'

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
        <Input
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
        <Input
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
        <Select
          value={filters.status ?? ALL}
          onValueChange={(v) => onStatus(v === ALL ? '' : (v as PosSaleStatus))}
          ariaLabel={t.posStatusFilter ?? 'Status'}
        >
          <SelectItem value={ALL}>{t.allStatuses ?? 'All statuses'}</SelectItem>
          <SelectItem value="ACTIVE">{t.posStatusActive ?? 'Active'}</SelectItem>
          <SelectItem value="VOIDED">{t.posVoided ?? 'Voided'}</SelectItem>
        </Select>

        <Select
          value={filters.paymentMode ?? ALL}
          onValueChange={(v) => onPaymentMode(v === ALL ? '' : (v as PaymentMode))}
          ariaLabel={t.posPaymentModeFilter ?? 'Payment mode'}
        >
          <SelectItem value={ALL}>{t.allModes ?? 'All modes'}</SelectItem>
          {PAYMENT_MODES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {t[m.labelKey as TranslationKey] as string ?? m.value}
            </SelectItem>
          ))}
        </Select>

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
