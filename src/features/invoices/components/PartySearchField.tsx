/** Search input field for party lookup — icon, input, clear/chevron controls */

import React from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartySearchFieldProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  query: string
  showDropdown: boolean
  onQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFocus: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onClear: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartySearchField: React.FC<PartySearchFieldProps> = ({
  inputRef,
  query,
  showDropdown,
  onQueryChange,
  onFocus,
  onKeyDown,
  onClear,
}) => {
  const { t } = useLanguage()
  return (
    <div className="party-search-input-wrap">
      <Search
        className="party-search-icon"
        size={16}
        aria-hidden="true"
      />
      <input
        id="party-search-input"
        ref={inputRef}
        type="text"
        className="input party-search-field"
        placeholder={t.searchPartyNamePhone}
        value={query}
        onChange={onQueryChange}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        autoComplete="off"
        aria-label={t.searchCustomerSupplier}
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />
      {query.length > 0 && (
        <button
          type="button"
          className="party-search-clear"
          onClick={onClear}
          aria-label={t.clearSearch}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {query.length === 0 && (
        <ChevronDown
          className="party-search-chevron"
          size={14}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
