/** SearchInput — the app's standard search field: a leading search icon, the
 *  text input, and a trailing control (a clear "✕" while there's text, or an
 *  optional element such as a dropdown chevron while empty).
 *
 *  Presentational only — the parent owns the value and the query state. Built
 *  on the `Input` primitive so it inherits the single-border focus treatment.
 *
 *    <SearchInput
 *      value={query}
 *      onChange={onQueryChange}
 *      placeholder={t.searchPartyNamePhone}
 *      onClear={handleClear}
 *      trailingWhenEmpty={<ChevronDown size={14} aria-hidden="true" />}
 *    />
 */

import React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import './search-input.css'

interface SearchInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  id?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  onFocus?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** When provided, a clear "✕" shows while the field has text. */
  onClear?: () => void
  /** Element rendered on the right while the field is empty (e.g. a chevron). */
  trailingWhenEmpty?: React.ReactNode
  ariaLabel?: string
  ariaExpanded?: boolean
  ariaHasPopup?: 'listbox' | 'menu' | 'dialog' | 'grid' | 'tree'
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both'
  className?: string
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder,
  id,
  inputRef,
  onFocus,
  onKeyDown,
  onClear,
  trailingWhenEmpty,
  ariaLabel,
  ariaExpanded,
  ariaHasPopup,
  ariaAutocomplete,
  className,
}) => {
  const { t } = useLanguage()
  const hasText = value.length > 0

  return (
    <div className={cn('search-input', className)}>
      <Search className="search-input-icon" size={16} aria-hidden="true" />
      <Input
        id={id}
        ref={inputRef}
        type="text"
        className="search-input-field"
        placeholder={placeholder ?? t.search}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        autoComplete="off"
        aria-label={ariaLabel ?? placeholder ?? t.search}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHasPopup}
        aria-autocomplete={ariaAutocomplete}
      />
      {hasText && onClear ? (
        <Button
          variant="none"
          type="button"
          className="search-input-trailing"
          onClick={onClear}
          aria-label={t.clearSearch}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      ) : (
        trailingWhenEmpty && (
          <span className="search-input-trailing search-input-trailing--static" aria-hidden="true">
            {trailingWhenEmpty}
          </span>
        )
      )}
    </div>
  )
}
