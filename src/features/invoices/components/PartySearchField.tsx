/** Search input field for party lookup — thin wrapper over the global
 *  <SearchInput> primitive with the invoice-specific placeholder / a11y. */

import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { SearchInput } from '@/components/ui/SearchInput'

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
    <SearchInput
      id="party-search-input"
      inputRef={inputRef}
      value={query}
      onChange={onQueryChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClear={onClear}
      placeholder={t.searchPartyNamePhone}
      ariaLabel={t.searchCustomerSupplier}
      ariaExpanded={showDropdown}
      ariaHasPopup="listbox"
      ariaAutocomplete="list"
      trailingWhenEmpty={<ChevronDown size={14} aria-hidden="true" />}
    />
  )
}
