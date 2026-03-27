/** Bulk Import Parties — State hook */

import { useState, useCallback, useRef } from 'react'
import { createParty } from '@/features/parties/party-crud.service'
import { IMPORT_BATCH_SIZE } from './bulk-import.constants'
import { validateContact, deduplicateContacts, toBulkPartyData, normalizePhone, parseCsv } from './bulk-import.utils'
import type { BulkImportStatus, ImportedContact, BulkImportResult, BulkPartyData } from './bulk-import.types'
import type { PartyType } from '@/lib/types/party.types'

export function useBulkImport() {
  const [status, setStatus] = useState<BulkImportStatus>('idle')
  const [contacts, setContacts] = useState<ImportedContact[]>([])
  const [partyType, setPartyType] = useState<PartyType>('CUSTOMER')
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ─── Contact Picker API (Android Chrome) ─────────────────────────────────
  const pickContacts = useCallback(async () => {
    setStatus('picking')
    setError(null)

    try {
      // @ts-expect-error Contact Picker API not in TS lib
      const props = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true })
      const imported: ImportedContact[] = props.map((c: { name?: string[]; tel?: string[]; email?: string[] }, i: number) => {
        const name = c.name?.[0] ?? ''
        const rawPhone = c.tel?.[0] ?? ''
        const email = c.email?.[0] ?? undefined
        return {
          id: `contact-${i}`,
          name,
          phone: normalizePhone(rawPhone),
          email,
          isSelected: true,
        }
      })

      const deduped = deduplicateContacts(imported)
      const validated = deduped.map(validateContact)
      setContacts(validated)
      setStatus(validated.length > 0 ? 'preview' : 'error')
      if (validated.length === 0) setError('No valid contacts found')
    } catch {
      setStatus('error')
      setError('Could not access contacts. Please grant permission or use CSV import.')
    }
  }, [])

  // ─── CSV Import ──────────────────────────────────────────────────────────
  const importCsv = useCallback((file: File) => {
    setStatus('picking')
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const csv = e.target?.result as string
      const parsed = parseCsv(csv)
      if (parsed.length === 0) {
        setStatus('error')
        setError('No contacts found in CSV. Ensure headers include "name" and "phone".')
        return
      }

      const deduped = deduplicateContacts(parsed)
      const validated = deduped.map(validateContact)
      setContacts(validated)
      setStatus('preview')
    }
    reader.onerror = () => {
      setStatus('error')
      setError('Failed to read CSV file.')
    }
    reader.readAsText(file)
  }, [])

  // ─── Toggle contact selection ────────────────────────────────────────────
  const toggleContact = useCallback((id: string) => {
    setContacts((prev) => prev.map((c) =>
      c.id === id ? { ...c, isSelected: !c.isSelected } : c,
    ))
  }, [])

  const selectAll = useCallback((selected: boolean) => {
    setContacts((prev) => prev.map((c) => c.error ? c : { ...c, isSelected: selected }))
  }, [])

  // ─── Execute bulk import ─────────────────────────────────────────────────
  const executeImport = useCallback(async () => {
    const parties = toBulkPartyData(contacts, partyType)
    if (parties.length === 0) return

    setStatus('importing')
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller

    const result: BulkImportResult = { total: parties.length, succeeded: 0, failed: 0, errors: [] }

    // Process in batches
    for (let i = 0; i < parties.length; i += IMPORT_BATCH_SIZE) {
      if (controller.signal.aborted) break

      const batch = parties.slice(i, i + IMPORT_BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((p) => createPartyFromBulk(p, controller.signal)),
      )

      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          result.succeeded++
        } else {
          result.failed++
          result.errors.push({
            name: batch[j].name,
            reason: (results[j] as PromiseRejectedResult).reason?.message ?? 'Failed',
          })
        }
      }

      setProgress(Math.min(i + batch.length, parties.length))
    }

    setImportResult(result)
    setStatus('done')
  }, [contacts, partyType])

  // ─── Reset ───────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
    setContacts([])
    setImportResult(null)
    setProgress(0)
    setError(null)
  }, [])

  const selectedCount = contacts.filter((c) => c.isSelected && !c.error).length
  const totalValid = contacts.filter((c) => !c.error).length

  return {
    status,
    contacts,
    partyType,
    setPartyType,
    importResult,
    progress,
    error,
    selectedCount,
    totalValid,
    pickContacts,
    importCsv,
    toggleContact,
    selectAll,
    executeImport,
    reset,
  }
}

/** Create a single party from bulk import data */
async function createPartyFromBulk(data: BulkPartyData, signal: AbortSignal) {
  return createParty(
    {
      name: data.name,
      phone: data.phone,
      email: data.email,
      type: data.type,
      tags: [],
      creditLimit: 0,
      creditLimitMode: 'WARN',
      addresses: [],
    },
    signal,
  )
}
