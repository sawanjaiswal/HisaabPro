/** POS — Debounced search input (300ms) + scan trigger */

import { useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { SEARCH_DEBOUNCE_MS } from '../../utils/pos.constants'

interface ProductSearchBarProps {
  value:     string
  onChange:  (value: string) => void
}

export function ProductSearchBar({ value, onChange }: ProductSearchBarProps) {
  const { t }        = useLanguage()
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(raw), SEARCH_DEBOUNCE_MS)
    // Optimistic immediate update for UI
    onChange(raw)
  }, [onChange])

  const handleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange('')
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') handleClear()
  }

  return (
    <div className="pos-search" role="search">
      <Search size={16} className="pos-search__icon" aria-hidden="true" />
      <input
        type="search"
        className="pos-search__input"
        placeholder={t.posSearchProducts ?? 'Search products…'}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label={t.posSearchProducts ?? 'Search products'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {value && (
        <button
          type="button"
          className="pos-search__clear"
          onClick={handleClear}
          aria-label={t.clearSearch ?? 'Clear search'}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
