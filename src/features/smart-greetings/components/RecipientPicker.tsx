/** Recipient Picker — Select parties to send greeting to */

import { useState, useEffect, useRef } from 'react'
import { Send, Search } from 'lucide-react'
import { getParties } from '@/features/parties/party-crud.service'
import type { PartyRecipient } from '../useSmartGreetings'

interface RecipientPickerProps {
  onSend: (party: PartyRecipient) => void
  onBack: () => void
}

interface SimpleParty {
  id: string
  name: string
  phone?: string
}

export function RecipientPicker({ onSend, onBack }: RecipientPickerProps) {
  const [parties, setParties] = useState<SimpleParty[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current = new AbortController()
    setIsLoading(true)
    getParties({ limit: 100, isActive: true }, abortRef.current.signal)
      .then((res: { parties: Array<{ id: string; name: string; phone?: string }> }) => {
        setParties(res.parties.map((p) => ({ id: p.id, name: p.name, phone: p.phone })))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
    return () => { abortRef.current?.abort() }
  }, [])

  const filtered = search
    ? parties.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : parties

  return (
    <div className="greeting-recipients">
      <div className="greeting-recipients-search">
        <Search size={18} className="greeting-recipients-search-icon" aria-hidden="true" />
        <input
          type="text"
          className="greeting-recipients-search-input"
          placeholder="Search parties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search parties"
        />
      </div>

      {isLoading ? (
        <p className="greeting-recipients-loading">Loading parties...</p>
      ) : (
        <div className="greeting-recipients-list" role="list" aria-label="Select recipients">
          {filtered.map((party) => (
            <div key={party.id} className="greeting-recipient-row" role="listitem">
              <div className="greeting-recipient-info">
                <span className="greeting-recipient-name">{party.name}</span>
                <span className="greeting-recipient-phone">
                  {party.phone ?? 'No phone'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onSend(party)}
                disabled={!party.phone}
                aria-label={`Send to ${party.name}`}
              >
                <Send size={14} aria-hidden="true" />
                Send
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="greeting-recipients-empty">No parties found</p>
          )}
        </div>
      )}

      <button type="button" className="btn btn-ghost btn-md greeting-recipients-back" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
