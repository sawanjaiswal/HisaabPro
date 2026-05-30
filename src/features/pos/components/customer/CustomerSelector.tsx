/** POS — Search existing party or walk-in toggle */

import { useState, useRef, useCallback } from 'react'
import { Search, X, UserCheck } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { WalkInForm } from './WalkInForm'
import { api } from '@/lib/api'
import { SEARCH_DEBOUNCE_MS } from '../../utils/pos.constants'
import { LoyaltyBalanceChip } from '@/features/loyalty/components/LoyaltyBalanceChip'
import { Input } from '@/components/ui/Input'

interface PartySuggestion {
  id:   string
  name: string
  phone?: string
}

interface CustomerSelectorProps {
  partyId?:    string
  walkInName?: string
  walkInPhone?: string
  onSelectParty:  (id: string, name: string) => void
  onClearParty:   () => void
  onWalkInChange: (name: string, phone: string) => void
}

export function CustomerSelector({
  partyId,
  walkInName,
  walkInPhone,
  onSelectParty,
  onClearParty,
  onWalkInChange,
}: CustomerSelectorProps) {
  const { t } = useLanguage()
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState<PartySuggestion[]>([])
  const [isOpen,      setIsOpen]      = useState(false)
  const [isWalkIn,    setIsWalkIn]    = useState(!partyId)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return }
    try {
      const res = await api<{ parties: PartySuggestion[] }>(
        `/parties?search=${encodeURIComponent(q)}&limit=8`,
        { cacheReads: false },
      )
      setSuggestions(res.parties ?? [])
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setIsOpen(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void search(v), SEARCH_DEBOUNCE_MS)
  }

  const handleSelect = (party: PartySuggestion) => {
    onSelectParty(party.id, party.name)
    setQuery('')
    setSuggestions([])
    setIsOpen(false)
    setIsWalkIn(false)
  }

  const toggleMode = () => {
    setIsWalkIn((prev) => {
      if (!prev) onClearParty()
      return !prev
    })
    setQuery('')
    setSuggestions([])
  }

  return (
    <div className="pos-customer">
      <div className="pos-customer__toggle">
        <button
          type="button"
          className={`pos-customer__tab${!isWalkIn ? ' pos-customer__tab--active' : ''}`}
          onClick={() => !isWalkIn || toggleMode()}
        >
          <Search size={13} aria-hidden="true" />
          {t.posCustomerSearch ?? 'Search customer'}
        </button>
        <button
          type="button"
          className={`pos-customer__tab${isWalkIn ? ' pos-customer__tab--active' : ''}`}
          onClick={() => isWalkIn || toggleMode()}
        >
          <UserCheck size={13} aria-hidden="true" />
          {t.posWalkIn ?? 'Walk-in'}
        </button>
      </div>

      {!isWalkIn && (
        <div className="pos-customer__search-wrap">
          {partyId ? (
            <div className="pos-customer__selected">
              <span className="pos-customer__selected-name">{query || (t.posCustomerSelected ?? 'Customer selected')}</span>
              <LoyaltyBalanceChip partyId={partyId} size="sm" />
              <button type="button" onClick={onClearParty} aria-label={t.posRemoveCustomer ?? 'Remove customer'}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <Input
                type="search"
                className="pos-field__input"
                placeholder={t.posSearchParty ?? 'Search by name or phone…'}
                value={query}
                onChange={handleQueryChange}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                aria-label={t.posSearchParty ?? 'Search party'}
                autoComplete="off"
              />
              {isOpen && suggestions.length > 0 && (
                <ul className="pos-customer__dropdown" role="listbox">
                  {suggestions.map((p) => (
                    <li
                      key={p.id}
                      className="pos-customer__option"
                      role="option"
                      aria-selected={p.id === partyId}
                      onMouseDown={() => handleSelect(p)}
                    >
                      <span className="pos-customer__option-name">{p.name}</span>
                      {p.phone && <span className="pos-customer__option-phone">{p.phone}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {isWalkIn && (
        <WalkInForm name={walkInName} phone={walkInPhone} onChange={onWalkInChange} />
      )}
    </div>
  )
}
