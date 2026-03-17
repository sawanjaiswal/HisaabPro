/** Party Search Input — debounced dropdown for party selection (shared component) */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { getParties } from '@/lib/services/party.service'
import type { PartySummary } from '@/lib/types/party.types'
import { PartySearchField } from './PartySearchField'
import { PartySearchDropdown } from './PartySearchDropdown'

// ─── Constants ───────────────────────────────────────────────────────────────

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

  const handleClearQuery = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

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
        <PartySearchField
          inputRef={inputRef}
          query={query}
          showDropdown={showDropdown}
          onQueryChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          onClear={handleClearQuery}
        />
      )}

      {showDropdown && (
        <PartySearchDropdown
          results={results}
          isLoading={isLoading}
          fetchError={fetchError}
          debouncedQuery={debouncedQuery}
          onSelect={handleSelect}
        />
      )}

      {error && (
        <span className="field-error" role="alert">{error}</span>
      )}
    </div>
  )
}
