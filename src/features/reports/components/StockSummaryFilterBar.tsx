/** StockSummaryFilterBar — search input + stock status pills + sort pills */

import { Search } from 'lucide-react'
import { ReportFilterPills } from './ReportFilterPills'
import {
  STOCK_SORT_LABELS,
} from '../report.constants'
import type { StockStatus } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_STOCK_STATUS = 'all'

export type StockStatusFilter = StockStatus | typeof ALL_STOCK_STATUS

const STOCK_STATUS_OPTIONS_BASE: Array<{
  value: string
  labelKey: 'all' | 'inStockLabel' | 'lowStock' | 'outOfStock'
}> = [
  { value: ALL_STOCK_STATUS, labelKey: 'all' },
  { value: 'in_stock', labelKey: 'inStockLabel' },
  { value: 'low', labelKey: 'lowStock' },
  { value: 'out_of_stock', labelKey: 'outOfStock' },
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
  const { t } = useLanguage()
  const stockStatusOptions = STOCK_STATUS_OPTIONS_BASE.map((opt) => ({
    value: opt.value,
    label: t[opt.labelKey],
  }))

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
          placeholder={t.searchProductsPlaceholder}
          defaultValue={searchDefault}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t.searchProductsByName}
          style={{ paddingLeft: 'var(--space-8)' }}
        />
      </div>

      {/* Stock status filter pills */}
      <ReportFilterPills
        options={stockStatusOptions}
        activeValue={activeStatusFilter}
        onChange={onStatusChange}
        ariaLabel={t.filterByStockStatus}
      />

      {/* Sort pills */}
      <ReportFilterPills
        options={STOCK_SORT_OPTIONS}
        activeValue={activeSortBy}
        onChange={onSortChange}
        ariaLabel={t.sortProducts}
      />
    </div>
  )
}
