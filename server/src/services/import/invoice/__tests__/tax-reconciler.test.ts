import { describe, expect, it } from 'vitest'
import { reconcileTaxTotals } from '../tax-reconciler.js'

describe('reconcileTaxTotals', () => {
  it('emits no issue on exact match', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 11800, reportedGrandPaise: 11800 })
    expect(r.diff).toBe(0)
    expect(r.issue).toBeNull()
  })

  it('tolerates +30 paise drift (within 50-paise window)', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 11830, reportedGrandPaise: 11800 })
    expect(r.diff).toBe(30)
    expect(r.issue).toBeNull()
  })

  it('tolerates -50 paise drift (boundary inclusive)', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 11750, reportedGrandPaise: 11800 })
    expect(r.diff).toBe(-50)
    expect(r.issue).toBeNull()
  })

  it('emits TAX_MATH_MISMATCH WARNING at 51 paise diff', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 11851, reportedGrandPaise: 11800 })
    expect(r.diff).toBe(51)
    expect(r.issue?.code).toBe('TAX_MATH_MISMATCH')
    expect(r.issue?.severity).toBe('WARNING')
  })

  it('emits TAX_MATH_MISMATCH WARNING at -51 paise diff', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 11749, reportedGrandPaise: 11800 })
    expect(r.diff).toBe(-51)
    expect(r.issue?.code).toBe('TAX_MATH_MISMATCH')
  })

  it('emits WARNING on massive mismatch (10x off)', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 118000, reportedGrandPaise: 11800 })
    expect(r.issue?.code).toBe('TAX_MATH_MISMATCH')
  })

  it('zero-tax with zero-totals matches cleanly', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 0, reportedGrandPaise: 0 })
    expect(r.issue).toBeNull()
  })

  it('does not overwrite source-of-record on mismatch (computed value lives only in payload)', () => {
    const r = reconcileTaxTotals({ computedGrandPaise: 12000, reportedGrandPaise: 11800 })
    expect(r.issue?.message).toContain('12000')
    expect(r.issue?.message).toContain('11800')
  })
})
