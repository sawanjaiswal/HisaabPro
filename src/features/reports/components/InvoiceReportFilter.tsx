/** InvoiceReportFilter — filter bar with date, status, group-by pills + sort select */

import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_LABELS,
  GROUP_BY_LABELS,
  SORT_BY_LABELS,
} from '../report.constants'
import { ReportFilterPills } from './ReportFilterPills'
import { useLanguage } from '@/hooks/useLanguage'
import type {
  DateRangePreset,
  InvoiceReportStatus,
  ReportGroupBy,
  ReportSortBy,
} from '../report.types'

// ─── "All" sentinel for the status filter ────────────────────────────────────

const STATUS_ALL = 'all' as const
export type StatusFilterValue = InvoiceReportStatus | typeof STATUS_ALL

const STATUS_OPTIONS_BASE: Array<{
  value: StatusFilterValue
  labelKey: 'all' | 'paid' | 'unpaid' | 'partial'
}> = [
  { value: STATUS_ALL, labelKey: 'all' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'unpaid', labelKey: 'unpaid' },
  { value: 'partial', labelKey: 'partial' },
]

const DATE_RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({
  value: preset,
  label: DATE_RANGE_LABELS[preset],
}))

const GROUP_BY_OPTIONS = (
  Object.keys(GROUP_BY_LABELS) as ReportGroupBy[]
).map((key) => ({ value: key, label: GROUP_BY_LABELS[key] }))

const SORT_BY_OPTIONS = (
  Object.keys(SORT_BY_LABELS) as ReportSortBy[]
).map((key) => ({ value: key, label: SORT_BY_LABELS[key] }))

// ─── Props ───────────────────────────────────────────────────────────────────

interface InvoiceReportFilterProps {
  activeDatePreset: DateRangePreset
  activeStatus: StatusFilterValue
  activeGroupBy: ReportGroupBy
  activeSortBy: ReportSortBy
  onDatePresetChange: (value: string) => void
  onStatusChange: (value: string) => void
  onGroupByChange: (value: string) => void
  onSortByChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

export function InvoiceReportFilter({
  activeDatePreset,
  activeStatus,
  activeGroupBy,
  activeSortBy,
  onDatePresetChange,
  onStatusChange,
  onGroupByChange,
  onSortByChange,
}: InvoiceReportFilterProps) {
  const { t } = useLanguage()
  const statusOptions = STATUS_OPTIONS_BASE.map((opt) => ({
    value: opt.value,
    label: t[opt.labelKey],
  }))

  return (
    <div className="report-filter-bar">
      <ReportFilterPills
        options={DATE_RANGE_OPTIONS}
        activeValue={activeDatePreset}
        onChange={onDatePresetChange}
        ariaLabel={t.dateRangeFilter}
      />

      <ReportFilterPills
        options={statusOptions}
        activeValue={activeStatus}
        onChange={onStatusChange}
        ariaLabel={t.paymentStatusFilter}
      />

      <ReportFilterPills
        options={GROUP_BY_OPTIONS}
        activeValue={activeGroupBy}
        onChange={onGroupByChange}
        ariaLabel={t.groupBy}
      />

      <div className="report-filter-pills">
        <select
          className="report-filter-pill"
          value={activeSortBy}
          onChange={onSortByChange}
          aria-label={t.sortOrder}
        >
          {SORT_BY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
