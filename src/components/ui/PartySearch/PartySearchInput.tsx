/** Party Search Input — debounced dropdown for party selection (shared component) */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { getParties } from '@/lib/services/party.service'
import { getParty } from '@/features/parties/party.service'
import type { PartySummary } from '@/lib/types/party.types'
import { PartySearchField } from './PartySearchField'
import { PartySearchDropdown } from './PartySearchDropdown'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { PartyBalanceChip } from '@/features/invoices/components/PartyBalanceChip'
import { useInstantAddParty } from '@/features/invoices/components/useInstantAddParty'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import '@/features/invoices/invoice-party-search.css'

// ─── Constants ───────────────────────────────────────────────────────────────

const SEARCH_LIMIT = 8
const RECENT_LIMIT = 8

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartySearchInputProps {
  /** Current selected party ID (empty string = nothing selected) */
  value: string
  onChange: (id: string, name: string) => void
  error?: string
  showLabel?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartySearchInput: React.FC<PartySearchInputProps> = ({
  value,
  onChange,
  error,
  showLabel = true,
}) => {
  const { t } = useLanguage()
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

  // ─── Fetch party name when initial/prop value is set ─────────────────────

  useEffect(() => {
    if (!value) {
      setSelectedName('')
      return
    }
    if (selectedName) return

    const controller = new AbortController()
    getParty(value, controller.signal)
      .then((p) => {
        if (p?.name) {
          setSelectedName(p.name)
          onChange(p.id, p.name)
        }
      })
      .catch(() => {
        // Fallback gracefully
      })

    return () => controller.abort()
  }, [value, selectedName, onChange])

  // ─── Fetch results when debounced query changes ──────────────────────────

  useEffect(() => {
    if (!isOpen) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setFetchError(false)

    const trimmed = debouncedQuery.trim()
    getParties(
      trimmed.length > 0 ? { search: trimmed, limit: SEARCH_LIMIT } : { limit: RECENT_LIMIT },
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

    return () => controller.abort()
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

  // ─── Instant Party Creation ───────────────────────────────────────────────

  const { isCreating, addParty } = useInstantAddParty({
    onCreated: (id, name) => {
      setSelectedName(name)
      setQuery('')
      setResults([])
      setIsOpen(false)
      onChange(id, name)
    },
    onError: () => setFetchError(true),
  })

  const handleAddNew = useCallback(() => {
    setFetchError(false)
    void addParty(query)
  }, [addParty, query])

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
      } else if (e.key === 'Enter' && query.trim() && results.length === 0 && !isLoading) {
        e.preventDefault()
        handleAddNew()
      }
    },
    [handleAddNew, isLoading, query, results.length],
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
      {showLabel && (
        <label className="label" htmlFor="party-search-input">
          {t.customerSupplierLabel || 'Customer / Supplier'}
        </label>
      )}

      {isSelected ? (
        <div
          className="party-selector-selected"
          role="status"
          aria-label={`Selected: ${selectedName}`}
        >
          <PartyAvatar name={selectedName} size="md" className="party-selector-avatar" />
          <div className="party-selector-info">
            <div className="party-selector-name">{selectedName}</div>
            <PartyBalanceChip partyId={value} />
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="party-selector-change-btn"
            onClick={handleClear}
            aria-label={t.changeSelectedParty || 'Change'}
          >
            {t.changeLabel || 'Change'}
          </Button>
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
          isCreating={isCreating}
          debouncedQuery={debouncedQuery}
          onSelect={handleSelect}
          onAddNew={handleAddNew}
        />
      )}

      {error && (
        <span className="field-error" role="alert">{error}</span>
      )}
    </div>
  )
}
