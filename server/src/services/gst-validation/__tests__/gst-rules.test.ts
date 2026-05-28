import { describe, it, expect } from 'vitest'
import { runGstRules, isValidGstin, isInterState } from '../gst-rules.js'
import type { CheckContext, CheckDoc, CheckLine } from '../gst-validation.types.js'

const line = (over: Partial<CheckLine> = {}): CheckLine => ({
  hsnCode: '1234',
  sacCode: null,
  taxableValue: 100000,
  cgstRate: 900,
  sgstRate: 900,
  igstRate: 0,
  ...over,
})

const doc = (over: Partial<CheckDoc> = {}): CheckDoc => ({
  id: over.id ?? 'd1',
  documentNumber: over.documentNumber ?? 'INV-1',
  supplyType: 'B2B',
  placeOfSupply: '27',
  totalCgst: 9000,
  totalSgst: 9000,
  totalIgst: 0,
  partyGstin: '27AAAAA0000A1Z5',
  lines: over.lines ?? [line()],
  ...over,
})

// Maharashtra seller (state 27), registered (not composition).
const ctx: CheckContext = { businessStateCode: '27', businessComposition: false }

const ids = (docs: CheckDoc[], c = ctx) => runGstRules(docs, c).map((r) => r.id)

describe('isValidGstin', () => {
  it('accepts a well-formed GSTIN', () => {
    expect(isValidGstin('27AAAAA0000A1Z5')).toBe(true)
  })
  it('rejects a too-short / malformed GSTIN', () => {
    expect(isValidGstin('27AAAAA0000A1Z')).toBe(false)
    expect(isValidGstin('GARBAGE')).toBe(false)
  })
})

describe('isInterState', () => {
  it('is true when place of supply differs from seller state', () => {
    expect(isInterState('29', '27')).toBe(true)
  })
  it('is false for same state', () => {
    expect(isInterState('27', '27')).toBe(false)
  })
  it('is false when either side is unknown', () => {
    expect(isInterState(null, '27')).toBe(false)
    expect(isInterState('27', null)).toBe(false)
  })
})

describe('runGstRules — clean document', () => {
  it('returns no findings for a valid intrastate B2B invoice', () => {
    expect(runGstRules([doc()], ctx)).toEqual([])
  })
})

describe('runGstRules — blockers', () => {
  it('flags B2B invoice missing party GSTIN', () => {
    expect(ids([doc({ partyGstin: null })])).toContain('B2B_MISSING_GSTIN')
  })

  it('flags malformed party GSTIN', () => {
    expect(ids([doc({ partyGstin: 'NOTAGSTIN' })])).toContain('INVALID_GSTIN_FORMAT')
  })

  it('flags missing place of supply on a taxable doc', () => {
    expect(ids([doc({ placeOfSupply: null })])).toContain('MISSING_PLACE_OF_SUPPLY')
  })

  it('flags CGST/SGST on an interstate supply', () => {
    // place of supply 29 ≠ seller 27 → interstate → must be IGST, but lines carry CGST/SGST.
    const d = doc({ placeOfSupply: '29' })
    expect(ids([d])).toContain('INTERSTATE_SPLIT_MISMATCH')
  })

  it('flags IGST on an intrastate supply', () => {
    const d = doc({ lines: [line({ cgstRate: 0, sgstRate: 0, igstRate: 1800 })] })
    expect(ids([d])).toContain('INTERSTATE_SPLIT_MISMATCH')
  })

  it('flags a composition dealer that charged GST', () => {
    const compCtx: CheckContext = { businessStateCode: '27', businessComposition: true }
    expect(ids([doc()], compCtx)).toContain('COMPOSITION_CHARGING_GST')
  })
})

describe('runGstRules — warnings', () => {
  it('flags a taxable line missing both HSN and SAC', () => {
    const d = doc({ lines: [line({ hsnCode: null, sacCode: null })] })
    expect(ids([d])).toContain('MISSING_HSN_SAC')
  })

  it('does NOT flag missing HSN when SAC is present', () => {
    const d = doc({ lines: [line({ hsnCode: null, sacCode: '998314' })] })
    expect(ids([d])).not.toContain('MISSING_HSN_SAC')
  })

  it('flags zero tax on a taxable line for a registered dealer', () => {
    const d = doc({
      totalCgst: 0,
      totalSgst: 0,
      lines: [line({ cgstRate: 0, sgstRate: 0, igstRate: 0 })],
    })
    expect(ids([d])).toContain('ZERO_TAX_ON_TAXABLE')
  })

  it('does NOT flag zero tax for a composition dealer', () => {
    const compCtx: CheckContext = { businessStateCode: '27', businessComposition: true }
    const d = doc({
      totalCgst: 0,
      totalSgst: 0,
      lines: [line({ cgstRate: 0, sgstRate: 0, igstRate: 0 })],
    })
    expect(ids([d], compCtx)).not.toContain('ZERO_TAX_ON_TAXABLE')
  })
})

describe('runGstRules — aggregation', () => {
  it('counts offenders and caps the document list', () => {
    const docs = Array.from({ length: 60 }, (_, i) =>
      doc({ id: `d${i}`, documentNumber: `INV-${i}`, partyGstin: null }),
    )
    const result = runGstRules(docs, ctx)
    const b2b = result.find((r) => r.id === 'B2B_MISSING_GSTIN')!
    expect(b2b.count).toBe(60)
    expect(b2b.documents).toHaveLength(50) // GST_CHECK_DOC_CAP
  })

  it('does not flag a B2C supply for missing GSTIN', () => {
    const d = doc({ supplyType: 'B2C_SMALL', partyGstin: null })
    expect(ids([d])).not.toContain('B2B_MISSING_GSTIN')
  })
})
