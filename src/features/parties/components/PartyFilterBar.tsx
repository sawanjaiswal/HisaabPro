import React from 'react'
import { Search, Filter } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PARTY_TYPE_FILTER_OPTIONS } from '../party.constants'
import type { PartyType, PartyListResponse } from '../party.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface PartyFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeType: PartyType | 'ALL'
  onTypeChange: (type: PartyType | 'ALL') => void
  /** Chip counts (All 128 · Customers 96 · …) from the list summary. */
  counts?: PartyListResponse['summary']
  /** Opens the advanced-filter drawer (status / outstanding). */
  onFilterClick?: () => void
  /** Dot on the filter button when a non-default status filter is applied. */
  hasActiveFilter?: boolean
}

export const PartyFilterBar: React.FC<PartyFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  counts,
  onFilterClick,
  hasActiveFilter = false,
}) => {
  const { t } = useLanguage()

  return (
    <div className="party-filter-bar">
      <div className="party-search-row">
        <div className="search-bar search-bar--pill">
          <Search size={20} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchByNamePhoneGstin}
            aria-label={t.searchParties}
          />
        </div>
        <Button
          variant="none"
          className={`party-filter-icon-btn${hasActiveFilter ? ' party-filter-icon-btn--active' : ''}`}
          onClick={onFilterClick}
          aria-label={t.filters}
        >
          <Filter size={20} aria-hidden="true" />
        </Button>
      </div>

      <div className="type-chips" role="group" aria-label={t.filters}>
        {PARTY_TYPE_FILTER_OPTIONS.map((option) => {
          const isActive = activeType === option.value
          const count = counts?.[option.countKey]
          return (
            <Button
              variant="none"
              key={option.value}
              className={`type-chip${isActive ? ' type-chip--on' : ''}`}
              onClick={() => onTypeChange(option.value)}
              aria-pressed={isActive}
            >
              {t[option.labelKey]}
              {count != null && <span className="type-chip-count">{count}</span>}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
