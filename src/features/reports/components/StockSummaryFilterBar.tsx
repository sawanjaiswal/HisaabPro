/** StockSummaryFilterBar — search input + stock status pills + sort pills */

import { Search } from 'lucide-react'
import { ReportFilterPills } from './ReportFilterPills'
import {
  STOCK_STATUS_LABELS,
  STOCK_SORT_LABELS,
} from '../report.constants'
import type { StockStatus } from '../report.types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_STOCK_STATUS = 'all'

export type StockStatusFilter = StockStatus | typeof ALL_STOCK_STATUS

const STOCK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ALL_STOCK_STATUS, label: 'All' },
  { value: 'in_stock', label: STOCK_STATUS_LABELS.in_stock },
  { value: 'low', label: STOCK_STATUS_LABELS.low },
  { value: 'out_of_stock', label: STOCK_STATUS_LABELS.out_of_stock },
]

const STOCK_SORT_OPTIONS: Array<{ value: string; label: string }> = Object.entries(
  STOCK_SORT_LABELS,
).map(([value, label]) => ({ value, label }))

// ─── Props ─────────────────────────────────────────────────────────────────────

interface StockSummaryFilterBarProps {
  searchDefault: string
  activeStatusFilter: StockStatusFilter
  activeSortBy: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onSortChange: (value: string) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function StockSummaryFilterBar({
  searchDefault,
  activeStatusFilter,
  activeSortBy,
  onSearchChange,
  onStatusChange,
  onSortChange,
}: StockSummaryFilterBarProps) {
  return (
    <div className="report-filter-bar">
      {/* Search input */}
      <div style={{ position: 'relative', flex: 1 }}>
        <Search
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-gray-400)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="search"
          className="input"
          placeholder="Search products..."
          defaultValue={searchDefault}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search products by name"
          style={{ paddingLeft: 'var(--space-8)' }}
        />
      </div>

      {/* Stock status filter pills */}
      <ReportFilterPills
        options={STOCK_STATUS_OPTIONS}
        activeValue={activeStatusFilter}
        onChange={onStatusChange}
        ariaLabel="Filter by stock status"
      />

      {/* Sort pills */}
      <ReportFilterPills
        options={STOCK_SORT_OPTIONS}
        activeValue={activeSortBy}
        onChange={onSortChange}
        ariaLabel="Sort products"
      />
    </div>
  )
}
