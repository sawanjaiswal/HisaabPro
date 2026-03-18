/** Bulk Import Parties — Pure utility functions */

import { PHONE_REGEX } from '@/features/parties/party.constants'
import { MAX_BULK_IMPORT } from './bulk-import.constants'
import type { ImportedContact, BulkPartyData } from './bulk-import.types'
import type { PartyType } from '@/lib/types/party.types'

/**
 * Normalize a phone number — strip country code, spaces, dashes.
 * Returns 10-digit Indian phone or empty string.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  // Strip +91 or 91 prefix
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 10) return digits
  return ''
}

/**
 * Validate and transform a contact into an ImportedContact.
 * Sets error field if name/phone is invalid.
 */
export function validateContact(contact: ImportedContact): ImportedContact {
  if (!contact.name.trim()) {
    return { ...contact, error: 'Name is required' }
  }
  if (!contact.phone) {
    return { ...contact, error: 'No phone number' }
  }
  if (!PHONE_REGEX.test(contact.phone)) {
    return { ...contact, error: 'Invalid Indian phone number' }
  }
  return { ...contact, error: undefined }
}

/**
 * Deduplicate contacts by phone number. Keep first occurrence.
 */
export function deduplicateContacts(contacts: ImportedContact[]): ImportedContact[] {
  const seen = new Set<string>()
  return contacts.filter((c) => {
    if (!c.phone || seen.has(c.phone)) return false
    seen.add(c.phone)
    return true
  })
}

/**
 * Parse a CSV string into ImportedContact[].
 * Expects headers: name, phone (at minimum). Optional: email.
 */
export function parseCsv(csv: string): ImportedContact[] {
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return [] // need header + at least 1 row

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'contact name' || h === 'party name')
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'phone number')
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'email address')

  if (nameIdx === -1 || phoneIdx === -1) return []

  const contacts: ImportedContact[] = []
  for (let i = 1; i < lines.length && contacts.length < MAX_BULK_IMPORT; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''))
    const name = cols[nameIdx]?.trim() ?? ''
    const rawPhone = cols[phoneIdx]?.trim() ?? ''
    const email = emailIdx >= 0 ? cols[emailIdx]?.trim() : undefined

    if (!name) continue

    contacts.push({
      id: `csv-${i}`,
      name,
      phone: normalizePhone(rawPhone),
      email: email || undefined,
      isSelected: true,
    })
  }

  return contacts
}

/**
 * Convert selected contacts to bulk party data.
 */
export function toBulkPartyData(
  contacts: ImportedContact[],
  partyType: PartyType,
): BulkPartyData[] {
  return contacts
    .filter((c) => c.isSelected && !c.error)
    .map((c) => ({
      name: c.name.trim(),
      phone: c.phone,
      email: c.email,
      type: partyType,
    }))
}
