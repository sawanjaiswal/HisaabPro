/** Invoice Form — HSN/SAC code typeahead
 *
 * Debounced (250ms) search at /api/hsn/search?q=&limit=10 (>=4 chars).
 * Results render in a portal popover so row layout is undisturbed.
 * Selecting a result sets hsnCode and switches tax picker to matched rate.
 * Visible only when gstEnabled + column is visible.
 */

import { useState, useRef, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { formatRate } from '@/features/tax/tax.constants'
import type { HsnCode } from '@/features/tax/tax.types'
import { useDebounce } from '@/hooks/useDebounce'

const MIN_QUERY_LEN = 4
const LIMIT = 10

interface HsnTypeaheadProps {
  lineIndex: number
  value: string
  onSelect: (code: string, defaultRateBP: number) => void
}

async function searchHsn(q: string): Promise<HsnCode[]> {
  return api<HsnCode[]>(`/hsn/search?q=${encodeURIComponent(q)}&limit=${LIMIT}`)
}

export function HsnTypeahead({ lineIndex, value, onSelect }: HsnTypeaheadProps) {
  const [inputVal, setInputVal] = useState(value)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const listboxId = `hsn-listbox-${uid}`
  const inputId = `hsn-input-${lineIndex}`

  const debouncedQ = useDebounce(inputVal.trim(), 250)
  const queryEnabled = debouncedQ.length >= MIN_QUERY_LEN

  const { data: results = [], isFetching, isError } = useQuery({
    queryKey: queryKeys.tax.hsn(debouncedQ),
    queryFn: () => searchHsn(debouncedQ),
    enabled: queryEnabled,
    staleTime: 60_000,
  })

  const getPopoverStyle = useCallback((): React.CSSProperties => {
    if (!inputRef.current) return { display: 'none' }
    const rect = inputRef.current.getBoundingClientRect()
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 9999,
    }
  }, [])

  const handleSelect = (item: HsnCode) => {
    setInputVal(item.code)
    setOpen(false)
    onSelect(item.code, item.defaultRate)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }

  const showDropdown = open && queryEnabled && (isFetching || isError || results.length > 0)

  return (
    <div className="hsn-typeahead">
      <label className="line-item-field-label" htmlFor={inputId}>
        HSN/SAC
      </label>
      <div className="hsn-input-wrap">
        <Search size={14} className="hsn-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="input hsn-input"
          value={inputVal}
          placeholder="Type 4+ chars"
          autoComplete="off"
          aria-label={`HSN or SAC code for line item ${lineIndex + 1}`}
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-expanded={showDropdown}
          onChange={(e) => {
            setInputVal(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showDropdown && createPortal(
        <div
          ref={popoverRef}
          id={listboxId}
          role="listbox"
          className="hsn-popover"
          style={getPopoverStyle()}
          aria-label="HSN code suggestions"
        >
          {isFetching && (
            <div className="hsn-popover-state">
              <Loader2 size={14} className="spin" aria-hidden="true" />
              Searching...
            </div>
          )}
          {isError && (
            <div className="hsn-popover-state hsn-popover-error">
              Search unavailable
            </div>
          )}
          {!isFetching && results.map((item) => (
            <button
              key={item.code}
              type="button"
              role="option"
              className="hsn-popover-item"
              onMouseDown={() => handleSelect(item)}
              aria-selected={inputVal === item.code}
            >
              <span className="hsn-code">{item.code}</span>
              <span className="hsn-desc">{item.description}</span>
              <span className="hsn-rate">{formatRate(item.defaultRate)}</span>
            </button>
          ))}
          {!isFetching && !isError && results.length === 0 && (
            <div className="hsn-popover-state">No results</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
