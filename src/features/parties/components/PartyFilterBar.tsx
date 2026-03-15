import React from 'react'
import { Search } from 'lucide-react'
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
  return (
    <div className="party-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or phone..."
          aria-label="Search parties by name or phone"
        />
      </div>
      <div className="pill-tabs" role="group" aria-label="Filter parties by type">
        {PARTY_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`pill-tab${activeType === option.value ? ' active' : ''}`}
            onClick={() => onTypeChange(option.value)}
            aria-pressed={activeType === option.value}
            aria-label={`Show ${option.label}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
