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

// ─── Option lists (static, computed once) ────────────────────────────────────

const DATE_RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({
  value: preset,
  label: DATE_RANGE_LABELS[preset],
}))

const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'in', label: 'Payment In' },
  { value: 'out', label: 'Payment Out' },
]

const PAYMENT_MODE_OPTIONS = [
  { value: '', label: 'All' },
  ...Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
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
        ariaLabel="Filter by date range"
      />

      {/* Row 2 — Payment type */}
      <ReportFilterPills
        options={PAYMENT_TYPE_OPTIONS}
        activeValue={filters.type ?? ''}
        onChange={(v) =>
          setFilter('type', v !== '' ? (v as 'in' | 'out') : undefined)
        }
        ariaLabel="Filter by payment type"
      />

      {/* Row 3 — Payment mode */}
      <ReportFilterPills
        options={PAYMENT_MODE_OPTIONS}
        activeValue={filters.mode ?? ''}
        onChange={(v) =>
          setFilter(
            'mode',
            v !== '' ? (v as PaymentHistoryMode) : undefined,
          )
        }
        ariaLabel="Filter by payment mode"
      />

      {/* Group by */}
      <ReportFilterPills
        options={GROUP_BY_OPTIONS}
        activeValue={filters.groupBy}
        onChange={(v) =>
          setFilter('groupBy', v as PaymentHistoryGroupBy)
        }
        ariaLabel="Group results by"
      />

      {/* Sort select */}
      <select
        className="report-filter-pill"
        value={filters.sortBy}
        onChange={(e) => setFilter('sortBy', e.target.value as ReportSortBy)}
        aria-label="Sort payments"
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
