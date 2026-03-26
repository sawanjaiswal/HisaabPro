/** Payment History — Filter bar with date range, type, mode, group, sort pills */

import { ReportFilterPills } from './ReportFilterPills'
import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_GROUP_BY_LABELS,
  SORT_BY_LABELS,
} from '../report.constants'
import { getDateRange } from '../report.utils'
import type {
  DateRangePreset,
  PaymentHistoryMode,
  PaymentHistoryGroupBy,
  PaymentHistoryFilters as Filters,
  ReportSortBy,
} from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

// ─── Option lists (static, computed once) ────────────────────────────────────

const DATE_RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({
  value: preset,
  label: DATE_RANGE_LABELS[preset],
}))

const PAYMENT_TYPE_OPTIONS_BASE = [
  { value: '', labelKey: 'all' as const },
  { value: 'in', labelKey: 'paymentIn' as const },
  { value: 'out', labelKey: 'paymentOut' as const },
]

const GROUP_BY_OPTIONS = Object.entries(PAYMENT_GROUP_BY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

// ─── Props ───────────────────────────────────────────────────────────────────

interface PaymentHistoryFilterProps {
  filters: Filters
  activeDatePreset: string
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentHistoryFilter({
  filters,
  activeDatePreset,
  setFilter,
}: PaymentHistoryFilterProps) {
  const { t } = useLanguage()
  const paymentTypeOptions = PAYMENT_TYPE_OPTIONS_BASE.map((opt) => ({
    value: opt.value,
    label: t[opt.labelKey],
  }))
  const paymentModeOptions = [
    { value: '', label: t.all },
    ...Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  ]

  return (
    <div className="report-filter-bar">
      {/* Row 1 — Date range presets */}
      <ReportFilterPills
        options={DATE_RANGE_OPTIONS}
        activeValue={activeDatePreset}
        onChange={(v) => {
          const range = getDateRange(v as DateRangePreset)
          setFilter('from', range.from)
          setFilter('to', range.to)
        }}
        ariaLabel={t.filterByDateRange}
      />

      {/* Row 2 — Payment type */}
      <ReportFilterPills
        options={paymentTypeOptions}
        activeValue={filters.type ?? ''}
        onChange={(v) =>
          setFilter('type', v !== '' ? (v as 'in' | 'out') : undefined)
        }
        ariaLabel={t.filterByPaymentType}
      />

      {/* Row 3 — Payment mode */}
      <ReportFilterPills
        options={paymentModeOptions}
        activeValue={filters.mode ?? ''}
        onChange={(v) =>
          setFilter(
            'mode',
            v !== '' ? (v as PaymentHistoryMode) : undefined,
          )
        }
        ariaLabel={t.filterByPaymentMode}
      />

      {/* Group by */}
      <ReportFilterPills
        options={GROUP_BY_OPTIONS}
        activeValue={filters.groupBy}
        onChange={(v) =>
          setFilter('groupBy', v as PaymentHistoryGroupBy)
        }
        ariaLabel={t.groupResultsBy}
      />

      {/* Sort select */}
      <select
        className="report-filter-pill"
        value={filters.sortBy}
        onChange={(e) => setFilter('sortBy', e.target.value as ReportSortBy)}
        aria-label={t.sortPayments}
      >
        {Object.entries(SORT_BY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
