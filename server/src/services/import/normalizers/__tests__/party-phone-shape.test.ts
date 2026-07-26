/**
 * The shape an imported party's phone is stored in.
 *
 * The import wrote E.164 (`+919876500011`) while every other writer of
 * `Party.phone` stores the bare 10 digits the create/update schema accepts.
 * Two consequences, both silent: exact-dedup compares the import's value to
 * `Party.phone` and therefore never matches a customer the shop already had,
 * and an imported party cannot be saved from the edit screen because the
 * stored phone fails the update schema on the way back in.
 */

import { describe, it, expect } from 'vitest'
import { normalisePhone } from '../party-normalizer.js'
import { PARTY_PHONE_REGEX, toPartyPhone } from '../../../../lib/party-phone.js'
import type { RowIssue } from '../../../../types/import.types.js'

describe('imported phone matches the stored Party.phone shape', () => {
  it('a plain 10-digit number stays 10 digits', () => {
    const issues: RowIssue[] = []
    const out = normalisePhone('9876500011', issues)
    expect(out).toBe('9876500011')
    expect(out && PARTY_PHONE_REGEX.test(out)).toBe(true)
    expect(issues).toHaveLength(0)
  })

  it('a country-coded number is reduced to the stored shape', () => {
    const issues: RowIssue[] = []
    expect(normalisePhone('+91 98765 00011', issues)).toBe('9876500011')
    expect(normalisePhone('919876500011', issues)).toBe('9876500011')
    expect(normalisePhone('09876500011', issues)).toBe('9876500011')
    expect(issues).toHaveLength(0)
  })

  it('a number that cannot be stored is flagged, not silently written', () => {
    const issues: RowIssue[] = []
    expect(normalisePhone('12345', issues)).toBeUndefined()
    // 5xxxxxxxxx is not an Indian mobile series — the update schema would
    // reject it, so the import must not create a party carrying it.
    expect(normalisePhone('5876500011', issues)).toBeUndefined()
    expect(issues.map((i) => i.code)).toEqual(['INVALID_PHONE', 'INVALID_PHONE'])
  })

  it('toPartyPhone is the shared converter', () => {
    expect(toPartyPhone('+91-98765-00011')).toBe('9876500011')
    expect(toPartyPhone('not a phone')).toBeNull()
    expect(toPartyPhone(null)).toBeNull()
  })
})
