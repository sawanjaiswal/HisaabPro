/** EntitySearch — Single Source of Truth for all entity search & creation boxes across HisaabPro.
 *
 * Provides:
 * - Debounced instant search with request abortion
 * - Keyboard navigation (ArrowUp, ArrowDown, Enter, Esc)
 * - Clean states (Loading, Error, Recent items, Empty with Instant Creation CTA)
 * - Bottom quick-add option when matching results exist
 * - Selected card view with Change CTA
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { formatRupees } from '@/lib/format'
import type { EntitySearchProps, EntitySearchItem } from './entity-search.types'
import './entity-search.css'

export function EntitySearch<T = any>({
  id = 'entity-search',
  label,
  placeholder,
  autoFocus = false,
  selectedId,
  selectedTitle,
  onSelect,
  onClearSelection,
  onFetchResults,
  mapToItem,
  entityName = 'item',
  entityPlural = 'items',
  onCreateOption,
  isCreating = false,
  emptyText,
  createOptionLabel,
  creatingLabel,
  searchHintLabel,
  renderSelected,
  renderItem,
  error,
  className = '',
  showLabel = true,
  keepOpenOnSelect = false,
}: EntitySearchProps<T>) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fetch results
  useEffect(() => {
    if (!isOpen) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setFetchError(false)

    onFetchResults(debouncedQuery.trim(), controller.signal)
      .then((res) => {
        setResults(res || [])
        setFetchError(false)
        setHighlightedIndex(-1)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchError(true)
        setResults([])
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [debouncedQuery, isOpen, onFetchResults])

  // Click outside to close
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!autoFocus) return
    const idTimer = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(idTimer)
  }, [autoFocus])

  const handleSelectItem = useCallback(
    (rawItem: T) => {
      onSelect(rawItem)
      if (!keepOpenOnSelect) {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    },
    [keepOpenOnSelect, onSelect],
  )

  const handleCreate = useCallback(() => {
    if (!onCreateOption || !query.trim() || isCreating) return
    void onCreateOption(query.trim())
  }, [isCreating, onCreateOption, query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelectItem(results[highlightedIndex])
        } else if (results.length === 0 && query.trim()) {
          handleCreate()
        }
      }
    },
    [handleCreate, handleSelectItem, highlightedIndex, query, results],
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    onClearSelection?.()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [onClearSelection])

  const isSelected = Boolean(selectedId && selectedTitle)
  const trimmedQuery = debouncedQuery.trim()
  const hasQuery = trimmedQuery.length > 0
  const items: EntitySearchItem[] = results.map(mapToItem)

  return (
    <div className={`entity-search ${className}`} ref={containerRef}>
      {showLabel && label && (
        <label className="entity-search-label" htmlFor={id}>
          {label}
        </label>
      )}

      {isSelected ? (
        renderSelected ? (
          renderSelected({ id: selectedId!, title: selectedTitle!, onClear: handleClear })
        ) : (
          <div className="entity-selected-card" role="status">
            <div className="entity-selected-card-info">
              <div className="entity-selected-card-details">
                <div className="entity-selected-card-title">{selectedTitle}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleClear}
              aria-label={t.changeLabel || 'Change'}
            >
              {t.changeLabel || 'Change'}
            </Button>
          </div>
        )
      ) : (
        <div className="entity-search-input-wrap">
          <Search className="entity-search-icon" size={16} aria-hidden="true" />
          <input
            id={id}
            ref={inputRef}
            type="text"
            className="entity-search-field"
            placeholder={placeholder || `${t.searchParties || 'Search'}...`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          />
          {query.length > 0 && (
            <button
              type="button"
              className="entity-search-clear"
              onClick={() => {
                setQuery('')
                setResults([])
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !isSelected && (
        <ul className="entity-search-dropdown" role="listbox">
          {isLoading && (
            <li className="entity-search-status" role="status" aria-live="polite">
              <span className="entity-search-spinner" aria-hidden="true" />
              <span>{t.searching || 'Searching...'}</span>
            </li>
          )}

          {!isLoading && fetchError && (
            <li className="entity-search-status entity-search-status--error" role="alert">
              {t.failedLoadParties || 'Failed to load results. Try again.'}
            </li>
          )}

          {!isLoading && !fetchError && hasQuery && items.length === 0 && (
            <li className="entity-search-empty-box">
              <p className="entity-search-empty-text">
                {emptyText ? (
                  emptyText(trimmedQuery)
                ) : (
                  <>
                    No {entityPlural} found for &ldquo;{trimmedQuery}&rdquo;
                  </>
                )}
              </p>
              {onCreateOption && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCreate()
                  }}
                  disabled={isCreating}
                  className="entity-search-cta-btn"
                >
                  {isCreating ? (
                    <>
                      <span className="entity-search-spinner" aria-hidden="true" />
                      <span>{creatingLabel || `Adding ${entityName}…`}</span>
                    </>
                  ) : createOptionLabel ? (
                    createOptionLabel(trimmedQuery)
                  ) : (
                    <>
                      <Plus size={16} aria-hidden="true" />
                      <span>+ Add &ldquo;{trimmedQuery}&rdquo; as a new {entityName}</span>
                    </>
                  )}
                </button>
              )}
            </li>
          )}

          {!isLoading && !fetchError && !hasQuery && items.length === 0 && (
            <li className="entity-search-status entity-search-status--hint">
              <span>{searchHintLabel || `Type to search ${entityPlural}...`}</span>
            </li>
          )}

          {!isLoading && items.map((item, idx) => {
            const isHighlighted = idx === highlightedIndex
            if (renderItem) return renderItem(item, () => handleSelectItem(results[idx]), isHighlighted)

            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`entity-search-item ${isHighlighted ? 'entity-search-item--highlighted' : ''} ${item.isAdded ? 'entity-search-item--added' : ''}`}
                  onClick={() => handleSelectItem(results[idx])}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="entity-search-item-info">
                    <div className="entity-search-item-title">{item.title}</div>
                    <div className="entity-search-item-meta">
                      {item.subtitle && <span>{item.subtitle}</span>}
                    </div>
                  </div>
                  <div className="entity-search-item-right">
                    {item.pricePaise !== undefined && (
                      <span className="entity-search-item-price">
                        {formatRupees(item.pricePaise)}
                      </span>
                    )}
                    {item.badge && (
                      <span className={`entity-search-badge entity-search-badge--${item.badge.variant || 'default'}`}>
                        {item.badge.text}
                      </span>
                    )}
                    {item.isAdded && (
                      <span className="entity-search-badge entity-search-badge--customer">
                        {t.addedLabel || 'Added'}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}

          {/* Quick add option when results exist and query is typed */}
          {!isLoading && !fetchError && onCreateOption && hasQuery && items.length > 0 && (
            <li>
              <button
                type="button"
                className="entity-search-bottom-add"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreate()
                }}
                disabled={isCreating}
              >
                {isCreating ? (
                  <span className="entity-search-spinner" aria-hidden="true" />
                ) : (
                  <Plus size={16} aria-hidden="true" />
                )}
                {createOptionLabel ? (
                  createOptionLabel(trimmedQuery)
                ) : (
                  <span>+ Add &ldquo;{trimmedQuery}&rdquo; as a new {entityName}</span>
                )}
              </button>
            </li>
          )}
        </ul>
      )}

      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  )
}
