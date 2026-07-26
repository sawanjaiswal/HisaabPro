import { describe, it, expect } from 'vitest'
import {
  normalizePartyRow,
  normaliseName,
  normalisePhone,
  normaliseEmail,
  normaliseGstin,
  normaliseAddress,
  normaliseOpeningBalance,
} from '../party-normalizer.js'
import {
  PARSER_CANONICAL_MAPPING,
  defaultMappingFor,
} from '../normalize-mappings.js'
import type { RawPartyRow, RowIssue } from '../../../../types/import.types.js'

function raw(o: Record<string, string>): RawPartyRow {
  return { sourceIndex: 0, raw: o }
}

describe('normalisePhone', () => {
  it('keeps 10-digit Indian numbers as +91XXXXXXXXXX', () => {
    const issues: never[] = []
    expect(normalisePhone('9111111111', issues)).toBe('9111111111')
    expect(issues).toHaveLength(0)
  })
  it('strips hyphens and spaces', () => {
    expect(normalisePhone('+91 91111-11111', [])).toBe('9111111111')
  })
  it('keeps already-+91 numbers', () => {
    expect(normalisePhone('9111111111', [])).toBe('9111111111')
  })
  it('marks <10 digit numbers INVALID_PHONE and returns undefined', () => {
    const issues: RowIssue[] = []
    expect(normalisePhone('12345', issues)).toBeUndefined()
    expect(issues[0]!.code).toBe('INVALID_PHONE')
  })
  it('marks >13 digit numbers INVALID_PHONE', () => {
    const issues: RowIssue[] = []
    expect(normalisePhone('12345678901234567', issues)).toBeUndefined()
    expect(issues[0]!.code).toBe('INVALID_PHONE')
  })
  it('returns undefined for blank input without an issue', () => {
    const issues: RowIssue[] = []
    expect(normalisePhone(undefined, issues)).toBeUndefined()
    expect(normalisePhone('', issues)).toBeUndefined()
    expect(normalisePhone('   ', issues)).toBeUndefined()
    expect(issues).toHaveLength(0)
  })
})

describe('normaliseGstin', () => {
  it('uppercases and accepts valid GSTIN', () => {
    expect(normaliseGstin('27aapfu0939f1zv', [])).toBe('27AAPFU0939F1ZV')
  })
  it('rejects malformed GSTIN with INVALID_GSTIN and returns undefined', () => {
    const issues: RowIssue[] = []
    expect(normaliseGstin('NOTAGSTIN', issues)).toBeUndefined()
    expect(issues[0]!.code).toBe('INVALID_GSTIN')
  })
})

describe('normaliseEmail', () => {
  it('lowercases valid emails', () => {
    expect(normaliseEmail('Raju@Foo.Com', [])).toBe('raju@foo.com')
  })
  it('rejects malformed emails', () => {
    const issues: RowIssue[] = []
    expect(normaliseEmail('not-an-email', issues)).toBeUndefined()
    expect(issues[0]!.code).toBe('INVALID_EMAIL')
  })
})

describe('normaliseName + normaliseAddress', () => {
  it('trims and collapses whitespace on name', () => {
    expect(normaliseName('  Raju    Traders  ', [])).toBe('Raju Traders')
  })
  it('flags missing name as MISSING_NAME', () => {
    const issues: RowIssue[] = []
    normaliseName('   ', issues)
    expect(issues[0]!.code).toBe('MISSING_NAME')
  })
  it('caps name at 200 chars with NAME_TOO_LONG', () => {
    const long = 'a'.repeat(300)
    const issues: RowIssue[] = []
    const out = normaliseName(long, issues)
    expect(out.length).toBe(200)
    expect(issues[0]!.code).toBe('NAME_TOO_LONG')
  })
  it('caps address at 500 chars', () => {
    const long = 'b'.repeat(600)
    const issues: RowIssue[] = []
    const out = normaliseAddress(long, issues)
    expect(out!.length).toBe(500)
    expect(issues[0]!.code).toBe('ADDRESS_TOO_LONG')
  })
})

describe('normaliseOpeningBalance', () => {
  it('plain number → paise', () => {
    expect(normaliseOpeningBalance('1000', [])).toBe(100000)
  })
  it('Indian comma format', () => {
    expect(normaliseOpeningBalance('1,00,000', [])).toBe(10000000)
  })
  it('Busy Dr suffix is positive', () => {
    expect(normaliseOpeningBalance('500 Dr', [])).toBe(50000)
  })
  it('Busy Cr suffix is negative', () => {
    expect(normaliseOpeningBalance('500 Cr', [])).toBe(-50000)
  })
  it('non-numeric → INVALID_AMOUNT', () => {
    const issues: RowIssue[] = []
    expect(normaliseOpeningBalance('abc', issues)).toBeUndefined()
    expect(issues[0]!.code).toBe('INVALID_AMOUNT')
  })
})

describe('normalizePartyRow (end-to-end)', () => {
  it('Vyapar happy row maps through default mapping', () => {
    const out = normalizePartyRow(
      raw({
        name: 'Raju Traders',
        phone: '9111111111',
        email: 'raju@traders.in',
        gstin: '27AAPFU0939F1ZV',
        address: 'Shop 4, MG Road',
        openingBalance: '1,00,000',
      }),
      PARSER_CANONICAL_MAPPING,
    )
    expect(out.name).toBe('Raju Traders')
    expect(out.phone).toBe('9111111111')
    expect(out.email).toBe('raju@traders.in')
    expect(out.gstin).toBe('27AAPFU0939F1ZV')
    expect(out.openingBalancePaise).toBe(10000000)
    expect(out.issues).toHaveLength(0)
  })

  it('Tally row case-insensitive header match', () => {
    const out = normalizePartyRow(
      raw({ name: 'Tally Party', phone: '9222222222' }),
      PARSER_CANONICAL_MAPPING,
    )
    expect(out.name).toBe('Tally Party')
    expect(out.phone).toBe('9222222222')
  })

  it('Busy Cr balance → negative paise', () => {
    const out = normalizePartyRow(
      raw({ name: 'X', phone: '9333333333', openingBalance: '500 Cr' }),
      PARSER_CANONICAL_MAPPING,
    )
    expect(out.openingBalancePaise).toBe(-50000)
  })

  it('keeps row even when phone invalid (issues populated)', () => {
    const out = normalizePartyRow(
      raw({ name: 'Raju', phone: '12345' }),
      PARSER_CANONICAL_MAPPING,
    )
    expect(out.name).toBe('Raju')
    expect(out.phone).toBeUndefined()
    expect(out.issues.some((i) => i.code === 'INVALID_PHONE')).toBe(true)
  })

  it('missing name surfaces MISSING_NAME', () => {
    const out = normalizePartyRow(
      raw({ name: '   ' }),
      PARSER_CANONICAL_MAPPING,
    )
    expect(out.issues[0]!.code).toBe('MISSING_NAME')
  })
})

describe('defaultMappingFor', () => {
  it('returns null for GENERIC_CSV', () => {
    expect(defaultMappingFor('GENERIC_CSV')).toBeNull()
  })
  // Known formats share one mapping because their parsers all emit the same
  // canonical row — the source headers live in each parser's own COLUMN_MAP.
  it('returns the canonical mapping for parser-canonicalised formats', () => {
    expect(defaultMappingFor('TALLY_XML')).toBe(PARSER_CANONICAL_MAPPING)
    expect(defaultMappingFor('VYAPAR_CSV')).toBe(PARSER_CANONICAL_MAPPING)
    expect(defaultMappingFor('BUSY_XLSX')).toBe(PARSER_CANONICAL_MAPPING)
  })
})
