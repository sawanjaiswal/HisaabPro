import React from 'react'
import { Search } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartyType } from '../party.types'
import { PARTY_TYPE_OPTIONS } from '../party.constants'

interface PartyFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeType: PartyType | 'ALL'
  onTypeChange: (type: PartyType | 'ALL') => void
}

export const PartyFilterBar: React.FC<PartyFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
}) => {
  const { t } = useLanguage()

  return (
    <div className="party-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByNameOrPhone}
          aria-label={t.searchParties}
        />
      </div>
      <div className="pill-tabs" role="group" aria-label={t.filterByPartyType}>
        {PARTY_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`pill-tab${activeType === option.value ? ' active' : ''}`}
            onClick={() => onTypeChange(option.value)}
            aria-pressed={activeType === option.value}
            aria-label={`${t.showLabel} ${option.label}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
