/** Dropdown list for party search results — loading, error, empty, hint, and result states */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartySummary, PartyType } from '@/lib/types/party.types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartySearchDropdownProps {
  results: PartySummary[]
  isLoading: boolean
  fetchError: boolean
  debouncedQuery: string
  onSelect: (party: PartySummary) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartySearchDropdown: React.FC<PartySearchDropdownProps> = ({
  results,
  isLoading,
  fetchError,
  debouncedQuery,
  onSelect,
}) => {
  const { t } = useLanguage()
  const PARTY_TYPE_LABELS: Record<PartyType, string> = {
    CUSTOMER: t.customer,
    SUPPLIER: t.supplier,
    BOTH: t.both,
  }
  const trimmedQuery = debouncedQuery.trim()

  return (
    <ul
      className="party-search-dropdown"
      role="listbox"
      aria-label={t.partySearchResults}
    >
      {isLoading && (
        <li className="party-search-status" role="status" aria-live="polite">
          <span className="party-search-spinner" aria-hidden="true" />
          {t.searching}
        </li>
      )}

      {!isLoading && fetchError && (
        <li className="party-search-status party-search-error" role="alert">
          {t.failedLoadParties}
        </li>
      )}

      {!isLoading && !fetchError && trimmedQuery.length > 0 && results.length === 0 && (
        <li className="party-search-status party-search-empty">
          {t.noPartiesFoundFor} &ldquo;{debouncedQuery}&rdquo;
        </li>
      )}

      {!isLoading && !fetchError && trimmedQuery.length === 0 && (
        <li className="party-search-status party-search-hint">
          {t.typeToSearchParties}
        </li>
      )}

      {!isLoading && results.map((party) => (
        <li
          key={party.id}
          className="party-search-result"
          role="option"
          aria-selected={false}
          onClick={() => onSelect(party)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect(party)
          }}
          tabIndex={0}
        >
          <div className="party-search-result-name">{party.name}</div>
          <div className="party-search-result-meta">
            {party.phone && (
              <span className="party-search-result-phone">{party.phone}</span>
            )}
            <span className={`party-search-type-badge party-search-type-badge--${party.type.toLowerCase()}`}>
              {PARTY_TYPE_LABELS[party.type]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
