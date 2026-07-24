/** useInstantAddParty — creates a party inline from the search query and
 *  selects it, without leaving the current form.
 *
 *  A query that looks like a phone number pre-fills the new party's phone;
 *  otherwise it becomes the name. Offline the create resolves with `{}` (no
 *  id), which we surface as an error rather than a broken selection.
 */

import { useState, useCallback } from 'react'
import { createParty } from '@/features/parties/party-crud.service'

/** A query that looks like a phone number pre-fills the new party's phone. */
const PHONE_RE = /^\+?\d[\d\s-]{6,}$/

interface UseInstantAddPartyArgs {
  /** Selects the freshly-created party (id + name). */
  onCreated: (id: string, name: string) => void
  /** Flags a failed create so the caller can show its error state. */
  onError: () => void
}

interface UseInstantAddPartyReturn {
  isCreating: boolean
  addParty: (rawName: string) => Promise<void>
}

export function useInstantAddParty({
  onCreated,
  onError,
}: UseInstantAddPartyArgs): UseInstantAddPartyReturn {
  const [isCreating, setIsCreating] = useState(false)

  const addParty = useCallback(
    async (rawName: string) => {
      const name = rawName.trim()
      if (!name || isCreating) return
      setIsCreating(true)
      try {
        const isPhone = PHONE_RE.test(name)
        const party = await createParty({
          name,
          type: 'CUSTOMER',
          tags: [],
          creditLimit: 0,
          creditLimitMode: 'WARN',
          addresses: [],
          customFields: [],
          ...(isPhone ? { phone: name.replace(/\s/g, '') } : {}),
        })
        if (!party?.id) {
          onError()
          return
        }
        onCreated(party.id, party.name)
      } catch {
        onError()
      } finally {
        setIsCreating(false)
      }
    },
    [isCreating, onCreated, onError],
  )

  return { isCreating, addParty }
}
