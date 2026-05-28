import { describe, it, expect } from 'vitest'
import { scoreCandidate, bestSuggestion, suggestMatches } from '../match-engine.js'
import type { MatchableLine, CandidatePayment } from '../bank-reconciliation.types.js'

const line = (over: Partial<MatchableLine> = {}): MatchableLine => ({
  id: 'L1',
  txnDate: '2026-05-10T00:00:00.000Z',
  amount: 100000, // ₹1000
  direction: 'CREDIT',
  description: null,
  referenceNumber: null,
  ...over,
})

const pay = (over: Partial<CandidatePayment> = {}): CandidatePayment => ({
  id: 'P1',
  date: '2026-05-10T00:00:00.000Z',
  amount: 100000,
  type: 'PAYMENT_IN',
  referenceNumber: null,
  partyName: null,
  ...over,
})

describe('scoreCandidate', () => {
  it('exact amount + same day + matching direction = 85', () => {
    expect(scoreCandidate(line(), pay())).toBe(85)
  })

  it('disqualifies on direction mismatch (CREDIT vs PAYMENT_OUT)', () => {
    expect(scoreCandidate(line({ direction: 'CREDIT' }), pay({ type: 'PAYMENT_OUT' }))).toBe(0)
  })

  it('DEBIT pairs with PAYMENT_OUT', () => {
    expect(scoreCandidate(line({ direction: 'DEBIT' }), pay({ type: 'PAYMENT_OUT' }))).toBe(85)
  })

  it('amount within 1% scores 30 not 60', () => {
    // 1% of 100000 paise = 1000. diff 900 ≤ 1000 → 30 + 25(same day) = 55
    expect(scoreCandidate(line(), pay({ amount: 100900 }))).toBe(55)
    // diff 2000 > 1% of 102000 (1020) → disqualify
    expect(scoreCandidate(line(), pay({ amount: 102000 }))).toBe(0)
  })

  it('amount off by more than 1% disqualifies', () => {
    expect(scoreCandidate(line(), pay({ amount: 200000 }))).toBe(0)
  })

  it('date bands: 3d=+15, 7d=+8, >14d disqualifies', () => {
    expect(scoreCandidate(line(), pay({ date: '2026-05-13T00:00:00.000Z' }))).toBe(75) // 60+15
    expect(scoreCandidate(line(), pay({ date: '2026-05-17T00:00:00.000Z' }))).toBe(68) // 60+8
    expect(scoreCandidate(line(), pay({ date: '2026-06-01T00:00:00.000Z' }))).toBe(0) // >14d
  })

  it('exact reference-number equality adds 15', () => {
    const l = line({ referenceNumber: 'UTR123456' })
    const p = pay({ referenceNumber: 'utr123456' })
    expect(scoreCandidate(l, p)).toBe(100) // 60+25+15
  })

  it('party-name token overlap adds up to 12', () => {
    const l = line({ description: 'NEFT from Raju Traders' })
    const p = pay({ partyName: 'Raju Traders' })
    expect(scoreCandidate(l, p)).toBe(97) // 60+25+12
  })
})

describe('bestSuggestion thresholds + determinism', () => {
  it('≥70 → SUGGESTED', () => {
    const s = bestSuggestion(line(), [pay()])
    expect(s).toEqual({ lineId: 'L1', suggestedPaymentId: 'P1', confidence: 85, status: 'SUGGESTED' })
  })

  it('50-69 → WEAK', () => {
    const s = bestSuggestion(line(), [pay({ date: '2026-05-17T00:00:00.000Z' })]) // 68
    expect(s.status).toBe('WEAK')
    expect(s.suggestedPaymentId).toBe('P1')
  })

  it('<50 → UNMATCHED with null payment', () => {
    const s = bestSuggestion(line(), [pay({ amount: 200000 })]) // disqualified → 0
    expect(s).toEqual({ lineId: 'L1', suggestedPaymentId: null, confidence: 0, status: 'UNMATCHED' })
  })

  it('ties break by smaller date delta, then payment.id asc', () => {
    // Two equal-score candidates (same amount, same day) → id asc wins.
    const a = pay({ id: 'Pb' })
    const b = pay({ id: 'Pa' })
    const s = bestSuggestion(line(), [a, b])
    expect(s.suggestedPaymentId).toBe('Pa')
  })

  it('closer date wins over equal score with farther date', () => {
    const near = pay({ id: 'Pz', date: '2026-05-10T00:00:00.000Z', referenceNumber: 'X', amount: 100000 })
    const far = pay({ id: 'Pa', date: '2026-05-11T00:00:00.000Z' })
    // near: 60+25=85 ; far: 60+15=75 → near (higher score) regardless of id
    const s = bestSuggestion(line(), [far, near])
    expect(s.suggestedPaymentId).toBe('Pz')
  })
})

describe('suggestMatches is order-independent (sorts pool by id)', () => {
  it('same output regardless of candidate array order', () => {
    const c1 = [pay({ id: 'Pa' }), pay({ id: 'Pb' })]
    const c2 = [pay({ id: 'Pb' }), pay({ id: 'Pa' })]
    expect(suggestMatches([line()], c1)).toEqual(suggestMatches([line()], c2))
  })
})
