import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  validateContact,
  deduplicateContacts,
  parseCsv,
  toBulkPartyData,
} from '../bulk-import.utils'
import type { ImportedContact } from '../bulk-import.types'

// ─── normalizePhone ───────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('returns 10-digit number as-is', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })

  it('strips +91 prefix', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210')
  })

  it('strips 91 prefix from 12-digit', () => {
    expect(normalizePhone('919876543210')).toBe('9876543210')
  })

  it('strips leading 0 from 11-digit', () => {
    expect(normalizePhone('09876543210')).toBe('9876543210')
  })

  it('strips spaces and dashes', () => {
    expect(normalizePhone('98765-43210')).toBe('9876543210')
    expect(normalizePhone('98765 43210')).toBe('9876543210')
  })

  it('returns empty for invalid length', () => {
    expect(normalizePhone('12345')).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})

// ─── validateContact ──────────────────────────────────────────────────────────

describe('validateContact', () => {
  const base: ImportedContact = { id: '1', name: 'Raju', phone: '9876543210', isSelected: true }

  it('returns no error for valid contact', () => {
    expect(validateContact(base).error).toBeUndefined()
  })

  it('returns error for empty name', () => {
    expect(validateContact({ ...base, name: '' }).error).toBe('Name is required')
    expect(validateContact({ ...base, name: '   ' }).error).toBe('Name is required')
  })

  it('returns error for missing phone', () => {
    expect(validateContact({ ...base, phone: '' }).error).toBe('No phone number')
  })

  it('returns error for invalid phone', () => {
    expect(validateContact({ ...base, phone: '1234567890' }).error).toBe('Invalid Indian phone number')
  })
})

// ─── deduplicateContacts ──────────────────────────────────────────────────────

describe('deduplicateContacts', () => {
  it('removes duplicate phones, keeping first', () => {
    const contacts: ImportedContact[] = [
      { id: '1', name: 'A', phone: '9876543210', isSelected: true },
      { id: '2', name: 'B', phone: '9876543210', isSelected: true },
      { id: '3', name: 'C', phone: '9999999999', isSelected: true },
    ]
    const result = deduplicateContacts(contacts)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('A')
    expect(result[1].name).toBe('C')
  })

  it('filters out contacts without phone', () => {
    const contacts: ImportedContact[] = [
      { id: '1', name: 'A', phone: '', isSelected: true },
    ]
    expect(deduplicateContacts(contacts)).toHaveLength(0)
  })
})

// ─── parseCsv ─────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses valid CSV with name and phone', () => {
    const csv = 'Name,Phone\nRaju,9876543210\nPriya,8765432109'
    const result = parseCsv(csv)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Raju')
    expect(result[0].phone).toBe('9876543210')
  })

  it('handles alternative header names', () => {
    const csv = 'Contact Name,Mobile,Email\nRaju,9876543210,r@test.com'
    const result = parseCsv(csv)
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('r@test.com')
  })

  it('returns empty for header-only CSV', () => {
    expect(parseCsv('Name,Phone')).toHaveLength(0)
  })

  it('returns empty for missing required headers', () => {
    expect(parseCsv('Foo,Bar\na,b')).toHaveLength(0)
  })

  it('strips quotes from values', () => {
    const csv = 'Name,Phone\n"Raju","9876543210"'
    const result = parseCsv(csv)
    expect(result[0].name).toBe('Raju')
  })

  it('skips rows with empty name', () => {
    const csv = 'Name,Phone\n,9876543210\nRaju,8765432109'
    const result = parseCsv(csv)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Raju')
  })
})

// ─── toBulkPartyData ──────────────────────────────────────────────────────────

describe('toBulkPartyData', () => {
  it('converts selected, error-free contacts', () => {
    const contacts: ImportedContact[] = [
      { id: '1', name: 'Raju', phone: '9876543210', isSelected: true },
      { id: '2', name: 'Priya', phone: '8765432109', isSelected: false },
      { id: '3', name: 'Amit', phone: '7654321098', isSelected: true, error: 'bad' },
    ]
    const result = toBulkPartyData(contacts, 'CUSTOMER')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'Raju',
      phone: '9876543210',
      email: undefined,
      type: 'CUSTOMER',
    })
  })
})
