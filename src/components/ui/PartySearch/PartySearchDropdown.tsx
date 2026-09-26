/** Dropdown list for party search results — loading, error, empty, hint, result states, and instant Add Client */

import React from 'react'
import { Plus, User } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartySummary, PartyType } from '@/lib/types/party.types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartySearchDropdownProps {
  results: PartySummary[]
  isLoading: boolean
  fetchError: boolean
  /** True while the inline "Add new party" create is in flight. */
  isCreating?: boolean
  debouncedQuery: string
  onSelect: (party: PartySummary) => void
  /** Create a party named after the current query and select it, instantly. */
  onAddNew?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartySearchDropdown: React.FC<PartySearchDropdownProps> = ({
  results,
  isLoading,
  fetchError,
  isCreating = false,
  debouncedQuery,
  onSelect,
  onAddNew,
}) => {
  const { t } = useLanguage()
  const PARTY_TYPE_LABELS: Record<PartyType, string> = {
    CUSTOMER: t.customer,
    SUPPLIER: t.supplier,
    BOTH: t.both,
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
        <li className="party-search-status party-search-empty flex flex-col items-center gap-2 py-4 px-3 text-center">
          <p className="text-xs text-gray-500 font-medium">
            {t.noPartiesFoundFor} &ldquo;{debouncedQuery}&rdquo;
          </p>
          {onAddNew && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAddNew()
              }}
              disabled={isCreating}
              className="w-full py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <span className="party-search-spinner" aria-hidden="true" />
                  <span>{t.creatingParty}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ {t.addParty} &ldquo;{trimmedQuery}&rdquo; {t.addAsNewClient}</span>
                </>
              )}
            </button>
          )}
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
          <User size={14} className="mr-1 inline" aria-hidden="true" />
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

      {/* Instant "Add new party" option at bottom */}
      {!isLoading && !fetchError && onAddNew && (
        <li
          className="party-search-add-new"
          role="option"
          aria-selected={false}
          aria-busy={isCreating}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onAddNew()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onAddNew()
            }
          }}
        >
          <span className="party-search-add-icon" aria-hidden="true">
            {isCreating ? <span className="party-search-spinner" /> : <Plus size={16} />}
          </span>
          <span className="party-search-add-label truncate">
            {isCreating
              ? t.creatingParty
              : trimmedQuery.length > 0
              ? `+ ${t.addParty} "${trimmedQuery}" ${t.addAsNewClient}`
              : t.addNewClientEntity}
          </span>
        </li>
      )}
    </ul>
  )
}
