/** Sales list filter bar — search + status filter chips. */

import React from 'react'
import { Search, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentStatus } from '../../invoices/invoice.types'
import '../sales-filter-bar.css'
import '../../invoices/invoice-filter-bar.css'
import { Input } from '@/components/ui/Input'

type StatusFilter = DocumentStatus | 'ALL'

const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL',       label: 'All' },
  { id: 'SAVED',     label: 'Saved' },
  { id: 'CONVERTED', label: 'Converted' },
  { id: 'DRAFT',     label: 'Draft' },
]

interface DocumentListFilterBarProps {
  search: string
  activeStatus: StatusFilter
  onSearchChange: (val: string) => void
  onStatusChange: (val: StatusFilter) => void
}

export const DocumentListFilterBar: React.FC<DocumentListFilterBarProps> = ({
  search,
  activeStatus,
  onSearchChange,
  onStatusChange,
}) => {
  const { t } = useLanguage()

  return (
    <div className="sales-filter-bar">
      <div className="sales-filter-search">
        <Search size={16} aria-hidden="true" className="sales-filter-search__icon" />
        <Input
          type="search"
          className="sales-filter-search__input"
          placeholder={t.searchInvoicesPlaceholder ?? 'Search by party or number…'}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t.searchInvoicesAriaLabel ?? 'Search documents'}
        />
        {search && (
          <button
            type="button"
            className="sales-filter-search__clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="sales-filter-chips" role="group" aria-label="Filter by status">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            role="radio"
            aria-checked={activeStatus === chip.id}
            className={`invoice-filter-pill${activeStatus === chip.id ? ' invoice-filter-pill--active' : ''}`}
            onClick={() => onStatusChange(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
