/** Dropdown list for party search results — loading, error, empty, hint, and result states */

import React from 'react'
import { Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartySummary, PartyType } from '@/lib/types/party.types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartySearchDropdownProps {
  results: PartySummary[]
  isLoading: boolean
  fetchError: boolean
  /** True while the inline "Add new party" create is in flight. */
  isCreating: boolean
  debouncedQuery: string
  onSelect: (party: PartySummary) => void
  /** Create a party named after the current query and select it, instantly. */
  onAddNew: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartySearchDropdown: React.FC<PartySearchDropdownProps> = ({
  results,
  isLoading,
  fetchError,
  isCreating,
  debouncedQuery,
  onSelect,
  onAddNew,
}) => {
  const { t } = useLanguage()
  const PARTY_TYPE_LABELS: Record<PartyType, string> = {
    CUSTOMER: t.customer,
    SUPPLIER: t.supplier,
    BOTH: t.both,
    // Phase 6 #136 PR1A — STAFF parties never reach this picker (server
    // filters `type != 'STAFF'` for invoice party search).
    STAFF: 'Staff',
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

      {/* Recent parties surface on focus, before any typing. */}
      {!isLoading && !fetchError && trimmedQuery.length === 0 && results.length > 0 && (
        <li className="party-search-section-label" aria-hidden="true">
          {t.recentParties}
        </li>
      )}

      {!isLoading && !fetchError && trimmedQuery.length === 0 && results.length === 0 && (
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

      {/* Instant "Add new party" — creates a party named after the query and
          selects it without leaving the invoice. Shown whenever the user has
          typed something that isn't an exact existing match. */}
      {!isLoading && !fetchError && trimmedQuery.length > 0 && (
        <li
          className="party-search-add-new"
          role="option"
          aria-selected={false}
          aria-busy={isCreating}
          tabIndex={0}
          onClick={onAddNew}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onAddNew()
          }}
        >
          <span className="party-search-add-icon" aria-hidden="true">
            {isCreating ? <span className="party-search-spinner" /> : <Plus size={16} />}
          </span>
          <span className="party-search-add-label">
            {isCreating ? t.creatingParty : <>{t.addParty} &ldquo;{trimmedQuery}&rdquo;</>}
          </span>
        </li>
      )}
    </ul>
  )
}
