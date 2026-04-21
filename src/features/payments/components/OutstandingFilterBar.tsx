/** Outstanding — search + type pills + overdue toggle + sort dropdown */

import React from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { OutstandingType, OutstandingSortBy } from '../payment.types'
import { OUTSTANDING_TYPE_LABELS, OUTSTANDING_SORT_LABELS } from '../payment.constants'

interface OutstandingFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeType: OutstandingType
  onTypeChange: (type: OutstandingType) => void
  overdueOnly: boolean
  onOverdueToggle: (value: boolean) => void
  sortBy: OutstandingSortBy
  onSortChange: (sort: OutstandingSortBy) => void
}

const OUTSTANDING_TYPES: OutstandingType[] = ['ALL', 'RECEIVABLE', 'PAYABLE']
const SORT_OPTIONS: OutstandingSortBy[] = ['amount', 'name', 'daysOverdue']

export const OutstandingFilterBar: React.FC<OutstandingFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  overdueOnly,
  onOverdueToggle,
  sortBy,
  onSortChange,
}) => {
  const { t } = useLanguage()
  return (
    <div className="outstanding-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByPartyName}
          aria-label={t.searchOutstandingParty}
        />
      </div>

      <div
        className="outstanding-filter-pills"
        role="group"
        aria-label={t.filterOutstandingType}
      >
        {OUTSTANDING_TYPES.map((type) => (
          <button
            key={type}
            className={`outstanding-filter-pill${activeType === type ? ' outstanding-filter-pill--active' : ''}`}
            onClick={() => onTypeChange(type)}
            aria-pressed={activeType === type}
            aria-label={`${t.showLabel} ${OUTSTANDING_TYPE_LABELS[type]}`}
          >
            {OUTSTANDING_TYPE_LABELS[type]}
          </button>
        ))}

        <button
          className={`outstanding-filter-pill${overdueOnly ? ' outstanding-filter-pill--active' : ''}`}
          onClick={() => onOverdueToggle(!overdueOnly)}
          aria-pressed={overdueOnly}
          aria-label={overdueOnly ? t.showingOverdueClick : t.showOverdueOnly}
        >
          {t.overdueOnly}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <SlidersHorizontal size={16} aria-hidden="true" style={{ color: 'var(--color-gray-500)', flexShrink: 0 }} />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as OutstandingSortBy)}
          aria-label={t.sortOutstandingList}
          style={{
            height: '44px',
            padding: '0 var(--space-3)',
            border: '1px solid var(--color-gray-200)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-gray-0)',
            color: 'var(--color-gray-700)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {OUTSTANDING_SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
