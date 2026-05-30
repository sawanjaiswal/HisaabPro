/** PriceListProductPicker — single-select product search for price list entry form */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useDebounce } from '@/hooks/useDebounce'
import { getProducts } from '@/lib/services/product.service'
import { formatPaise } from '@/lib/format'
import type { ProductSummary } from '@/lib/types/product.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export interface SelectedProduct { id: string; name: string; salePrice: number }

interface Props {
  selected: SelectedProduct | null
  onSelect: (p: SelectedProduct) => void
  onClear: () => void
  error?: string
  /** Lock to display-only (edit mode — product already persisted) */
  readOnly?: boolean
}

const LIMIT = 10

export const PriceListProductPicker: React.FC<Props> = ({
  selected, onSelect, onClear, error, readOnly = false,
}) => {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isOpen || !debouncedQuery.trim()) { setResults([]); return }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setIsLoading(true); setFetchError(false)
    getProducts({ search: debouncedQuery.trim(), limit: LIMIT }, ctrl.signal)
      .then(res => { setResults(res.products); setFetchError(false) })
      .catch((err: unknown) => { if (err instanceof Error && err.name === 'AbortError') return; setFetchError(true); setResults([]) })
      .finally(() => setIsLoading(false))
    return () => ctrl.abort()
  }, [debouncedQuery, isOpen])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleSelect = useCallback((p: ProductSummary) => {
    onSelect({ id: p.id, name: p.name, salePrice: p.salePrice })
    setQuery(''); setResults([]); setIsOpen(false)
  }, [onSelect])

  const handleClear = useCallback(() => {
    onClear(); setQuery(''); setResults([])
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [onClear])

  // Selected state (display chip + optional clear button)
  if (selected) {
    return (
      <div className="pl-product-picker">
        <div className="pl-product-picker__selected">
          <span className="pl-product-picker__name">{selected.name}</span>
          <span className="pl-product-picker__price">
            {t.plEntryProductBadge}: {formatPaise(selected.salePrice)}
          </span>
          {!readOnly && (
            <Button variant="none" type="button" className="pl-product-picker__clear" onClick={handleClear} aria-label={t.plEntryClearProduct}>
              <X size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
        {error && <span className="input__error" role="alert">{error}</span>}
      </div>
    )
  }

  // Search state
  return (
    <div className="pl-product-picker" ref={containerRef}>
      <div className="product-search-input-wrap">
        <Search className="product-search-icon" size={16} aria-hidden="true" />
        <Input
          ref={inputRef} type="text"
          className={`input product-search-field${error ? ' input--error' : ''}`}
          placeholder={t.plEntryProductSearch} value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') setIsOpen(false) }}
          autoComplete="off" aria-label={t.plEntrySelectProduct}
          aria-expanded={isOpen} aria-haspopup="listbox" aria-autocomplete="list" aria-invalid={!!error}
        />
        {query && (
          <Button variant="none" type="button" className="product-search-clear" onClick={() => { setQuery(''); setResults([]) }} aria-label={t.clearProductSearch}>
            <X size={14} aria-hidden="true" />
          </Button>
        )}
      </div>
      {error && <span className="input__error" role="alert">{error}</span>}
      {isOpen && (
        <ul className="product-search-dropdown" role="listbox" aria-label={t.productSearchResults}>
          {isLoading && <li className="product-search-status" role="status" aria-live="polite"><span className="product-search-spinner" aria-hidden="true" />{t.searching}</li>}
          {!isLoading && fetchError && <li className="product-search-status product-search-error" role="alert">{t.failedLoadProducts}</li>}
          {!isLoading && !fetchError && debouncedQuery.trim() && !results.length && (
            <li className="product-search-status product-search-empty">{t.noProductsFoundFor} &ldquo;{debouncedQuery}&rdquo;</li>
          )}
          {!isLoading && !fetchError && !debouncedQuery.trim() && (
            <li className="product-search-status product-search-hint">{t.typeToSearchProducts}</li>
          )}
          {!isLoading && results.map(p => (
            <li key={p.id} className="product-search-result" role="option" aria-selected={false}
              onClick={() => handleSelect(p)} style={{ cursor: 'pointer' }}
              aria-label={`${p.name}, ${formatPaise(p.salePrice)}`}
            >
              <div className="product-search-result-info">
                <div className="product-search-result-name">{p.name}</div>
                {p.sku && <div className="product-search-result-meta"><span className="product-search-result-sku">{p.sku}</span></div>}
              </div>
              <span className="product-search-result-price">{formatPaise(p.salePrice)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
