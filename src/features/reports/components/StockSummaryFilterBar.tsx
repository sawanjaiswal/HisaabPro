/** StockSummaryFilterBar — search input + stock status pills + sort pills */

import { Search } from 'lucide-react'
import { ReportFilterPills } from './ReportFilterPills'
import {
  STOCK_SORT_LABELS,
} from '../report.constants'
import type { StockStatus } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'

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
      <div className="flex-1">
        <Input
          type="search"
          placeholder={t.searchProductsPlaceholder}
          defaultValue={searchDefault}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t.searchProductsByName}
          leftIcon={<Search size={16} className="text-[var(--color-gray-400)]" aria-hidden="true" />}
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
