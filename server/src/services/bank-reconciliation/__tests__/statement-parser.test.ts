import { describe, it, expect } from 'vitest'
import {
  normaliseRow,
  normaliseRows,
  computePeriod,
  contentHash,
  poolWindow,
} from '../statement-parser.js'
import type { StatementRowInput } from '../bank-reconciliation.types.js'

const row = (over: Partial<StatementRowInput> = {}): StatementRowInput => ({
  txnDate: '2026-05-10T00:00:00.000Z',
  amount: 100000,
  direction: 'CREDIT',
  description: '  NEFT credit  ',
  referenceNumber: '  UTR99  ',
  ...over,
})

describe('normaliseRow', () => {
  it('trims text and parses date', () => {
    const n = normaliseRow(row())
    expect(n.description).toBe('NEFT credit')
    expect(n.referenceNumber).toBe('UTR99')
    expect(n.txnDate.toISOString()).toBe('2026-05-10T00:00:00.000Z')
  })

  it('empty/whitespace text becomes null', () => {
    const n = normaliseRow(row({ description: '   ', referenceNumber: null }))
    expect(n.description).toBeNull()
    expect(n.referenceNumber).toBeNull()
  })

  it('clamps overlong description to 500 chars', () => {
    const n = normaliseRow(row({ description: 'x'.repeat(800) }))
    expect(n.description).toHaveLength(500)
  })
})

describe('computePeriod', () => {
  it('returns null for empty input', () => {
    expect(computePeriod([])).toBeNull()
  })

  it('returns inclusive min/max txnDate', () => {
    const rows = normaliseRows([
      row({ txnDate: '2026-05-10T00:00:00.000Z' }),
      row({ txnDate: '2026-05-01T00:00:00.000Z' }),
      row({ txnDate: '2026-05-20T00:00:00.000Z' }),
    ])
    const period = computePeriod(rows)!
    expect(period.start.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(period.end.toISOString()).toBe('2026-05-20T00:00:00.000Z')
  })
})

describe('contentHash dedupe key', () => {
  it('identical day+amount+direction+ref hash equal', () => {
    expect(contentHash(normaliseRow(row()))).toBe(contentHash(normaliseRow(row())))
  })

  it('differs when amount differs', () => {
    expect(contentHash(normaliseRow(row()))).not.toBe(contentHash(normaliseRow(row({ amount: 100001 }))))
  })

  it('case-insensitive on reference number', () => {
    expect(contentHash(normaliseRow(row({ referenceNumber: 'AbC' })))).toBe(
      contentHash(normaliseRow(row({ referenceNumber: 'abc' }))),
    )
  })
})

describe('poolWindow', () => {
  it('widens period by ±14 days', () => {
    const w = poolWindow({
      start: new Date('2026-05-10T00:00:00.000Z'),
      end: new Date('2026-05-20T00:00:00.000Z'),
    })
    expect(w.min.toISOString()).toBe('2026-04-26T00:00:00.000Z')
    expect(w.max.toISOString()).toBe('2026-06-03T00:00:00.000Z')
  })
})
