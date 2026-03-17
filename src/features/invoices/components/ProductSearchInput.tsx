/** Product Search Input — inline search + tap-to-add for invoice line items */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { getProducts } from '@/lib/services/product.service'
import type { ProductSummary } from '@/lib/types/product.types'
import { paiseToRupees } from '../invoice-format.utils'
import { ProductSearchDropdown } from './ProductSearchDropdown'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEARCH_LIMIT = 10

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductSearchInputProps {
  /** Called when user taps a product — passes productId, rate (paise), name */
  onSelect: (productId: string, ratePaise: number, productName: string) => void
  /** IDs of products already in the line items — shown as "Added" */
  addedProductIds: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ProductSearchInput: React.FC<ProductSearchInputProps> = ({
  onSelect,
  addedProductIds,
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

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

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setFetchError(false)

    getProducts(
      { search: debouncedQuery.trim(), limit: SEARCH_LIMIT },
      controller.signal,
    )
      .then((res) => {
        setResults(res.products)
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

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }, [])

  const handleFocus = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handleClearQuery = useCallback(() => {
    setQuery('')
    setResults([])
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleAdd = useCallback(
    (product: ProductSummary) => {
      onSelect(product.id, product.salePrice, product.name)
      // Keep search open so user can add more items
    },
    [onSelect],
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const showDropdown = isOpen

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="product-search" ref={containerRef}>
      <div className="product-search-input-wrap">
        <Search
          className="product-search-icon"
          size={16}
          aria-hidden="true"
        />
        <input
          id="product-search-input"
          ref={inputRef}
          type="text"
          className="input product-search-field"
          placeholder="Search product name or SKU..."
          value={query}
          onChange={handleQueryChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-label="Search for a product to add"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          style={{ minHeight: '44px' }}
        />
        {query.length > 0 && (
          <button
            type="button"
            className="product-search-clear"
            onClick={handleClearQuery}
            aria-label="Clear product search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {showDropdown && (
        <ProductSearchDropdown
          results={results}
          isLoading={isLoading}
          fetchError={fetchError}
          debouncedQuery={debouncedQuery}
          addedProductIds={addedProductIds}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}

// Re-export for caller convenience — caller uses paiseToRupees for display
export { paiseToRupees }
