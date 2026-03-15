/** Party Search Input — debounced dropdown for invoice form party selection */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { getParties } from '@/features/parties/party.service'
import type { PartySummary, PartyType } from '@/features/parties/party.types'

// ─── Constants ───────────────────────────────────────────────────────────────

const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  BOTH: 'Both',
}

const SEARCH_LIMIT = 5

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartySearchInputProps {
  /** Current selected party ID (empty string = nothing selected) */
  value: string
  onChange: (id: string, name: string) => void
  error?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartySearchInput: React.FC<PartySearchInputProps> = ({
  value,
  onChange,
  error,
}) => {
  const [query, setQuery] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [results, setResults] = useState<PartySummary[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ─── Fetch results when debounced query changes ──────────────────────────

  useEffect(() => {
    if (!isOpen) return
    if (debouncedQuery.trim().length === 0) {
      setResults([])
      return
    }

    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setFetchError(false)

    getParties(
      { search: debouncedQuery.trim(), limit: SEARCH_LIMIT },
      controller.signal,
    )
      .then((res) => {
        setResults(res.parties)
        setFetchError(false)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchError(true)
        setResults([])
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [debouncedQuery, isOpen])

  // ─── Close dropdown on outside click ────────────────────────────────────

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // ─── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }, [])

  const handleSelect = useCallback(
    (party: PartySummary) => {
      setSelectedName(party.name)
      setQuery('')
      setResults([])
      setIsOpen(false)
      onChange(party.id, party.name)
    },
    [onChange],
  )

  const handleClear = useCallback(() => {
    setSelectedName('')
    setQuery('')
    setResults([])
    onChange('', '')
    // Focus the input after clearing
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [onChange])

  const handleInputFocus = useCallback(() => {
    if (!value) {
      setIsOpen(true)
    }
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    },
    [],
  )

  // ─── Derived state ────────────────────────────────────────────────────────

  const isSelected = Boolean(value && selectedName)
  const showDropdown = isOpen && !isSelected

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="party-search" ref={containerRef}>
      <label className="label" htmlFor="party-search-input">
        Customer / Supplier
      </label>

      {isSelected ? (
        // ── Selected state ─────────────────────────────────────────────────
        <div className="party-selector-selected" role="status" aria-label={`Selected: ${selectedName}`}>
          <div className="party-selector-info">
            <div className="party-selector-name">{selectedName}</div>
          </div>
          <button
            type="button"
            className="party-selector-change"
            onClick={handleClear}
            aria-label="Change selected party"
          >
            Change
          </button>
        </div>
      ) : (
        // ── Search input ───────────────────────────────────────────────────
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
            placeholder="Search party name or phone..."
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-label="Search customer or supplier"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            style={{ minHeight: '44px' }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="party-search-clear"
              onClick={() => {
                setQuery('')
                setResults([])
              }}
              aria-label="Clear search"
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
      )}

      {/* ── Dropdown ───────────────────────────────────────────────────── */}
      {showDropdown && (
        <ul
          className="party-search-dropdown"
          role="listbox"
          aria-label="Party search results"
        >
          {isLoading && (
            <li className="party-search-status" role="status" aria-live="polite">
              <span className="party-search-spinner" aria-hidden="true" />
              Searching...
            </li>
          )}

          {!isLoading && fetchError && (
            <li className="party-search-status party-search-error" role="alert">
              Failed to load parties. Try again.
            </li>
          )}

          {!isLoading && !fetchError && debouncedQuery.trim().length > 0 && results.length === 0 && (
            <li className="party-search-status party-search-empty">
              No parties found for "{debouncedQuery}"
            </li>
          )}

          {!isLoading && !fetchError && debouncedQuery.trim().length === 0 && (
            <li className="party-search-status party-search-hint">
              Type to search parties
            </li>
          )}

          {!isLoading && results.map((party) => (
            <li
              key={party.id}
              className="party-search-result"
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(party)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSelect(party)
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
      )}

      {error && (
        <span className="field-error" role="alert">{error}</span>
      )}
    </div>
  )
}
