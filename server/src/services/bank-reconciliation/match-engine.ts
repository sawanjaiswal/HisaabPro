/**
 * #147 Match engine — PURE. No DB, no clock, no Date.now().
 * Deterministic: same (lines, candidatePayments) input → same output, including
 * tie-breaks. The service must sort the candidate pool by id asc before calling.
 */
import type {
  MatchableLine,
  CandidatePayment,
  LineSuggestion,
  LineDirection,
} from './bank-reconciliation.types.js'

const SUGGEST_THRESHOLD = 70
const WEAK_THRESHOLD = 50
const MS_PER_DAY = 86_400_000

/** Whole-day absolute delta between two ISO dates (pure — parses, never reads now). */
function dayDelta(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  return Math.floor(Math.abs(a - b) / MS_PER_DAY)
}

/** CREDIT (money in) pairs with inbound payment types; DEBIT with outbound. */
function directionMatchesType(direction: LineDirection, type: string): boolean {
  if (direction === 'CREDIT') return type === 'PAYMENT_IN' || type === 'PAYROLL_IN'
  return type === 'PAYMENT_OUT' || type === 'PAYROLL_OUT'
}

function tokenize(value: string | null): string[] {
  if (!value) return []
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 3)
}

/** Reference / party-name token overlap → 0..15. */
function tokenScore(line: MatchableLine, payment: CandidatePayment): number {
  const lineTokens = new Set([...tokenize(line.referenceNumber), ...tokenize(line.description)])
  if (lineTokens.size === 0) return 0
  const payTokens = new Set([...tokenize(payment.referenceNumber), ...tokenize(payment.partyName)])
  if (payTokens.size === 0) return 0

  // Exact reference-number equality is the strongest signal.
  if (
    line.referenceNumber &&
    payment.referenceNumber &&
    line.referenceNumber.trim().toLowerCase() === payment.referenceNumber.trim().toLowerCase()
  ) {
    return 15
  }

  let overlap = 0
  for (const t of payTokens) if (lineTokens.has(t)) overlap++
  if (overlap === 0) return 0
  if (overlap >= 2) return 12
  return 8
}

/**
 * Score one (line, payment) pair → 0..100 integer.
 * Returns 0 (disqualified) when direction is wrong or amount is too far off.
 */
export function scoreCandidate(line: MatchableLine, payment: CandidatePayment): number {
  if (!directionMatchesType(line.direction, payment.type)) return 0

  let amountScore: number
  if (line.amount === payment.amount) {
    amountScore = 60
  } else {
    const diff = Math.abs(line.amount - payment.amount)
    const onePct = Math.max(1, Math.round(payment.amount / 100))
    if (diff <= onePct) amountScore = 30
    else return 0 // amount too far off → disqualify
  }

  const delta = dayDelta(line.txnDate, payment.date)
  let dateScore: number
  if (delta === 0) dateScore = 25
  else if (delta <= 3) dateScore = 15
  else if (delta <= 7) dateScore = 8
  else if (delta <= 14) dateScore = 0
  else return 0 // outside ±14d window → disqualify

  return amountScore + dateScore + tokenScore(line, payment)
}

/**
 * Best suggestion for one line over a candidate pool.
 * Tie-break (deterministic): higher score, then smaller day delta, then payment.id asc.
 * Caller MUST pass `candidates` pre-sorted by id asc for stable ties.
 */
export function bestSuggestion(
  line: MatchableLine,
  candidates: CandidatePayment[],
): LineSuggestion {
  let best: { payment: CandidatePayment; score: number; delta: number } | null = null

  for (const payment of candidates) {
    const score = scoreCandidate(line, payment)
    if (score <= 0) continue
    const delta = dayDelta(line.txnDate, payment.date)
    if (
      best === null ||
      score > best.score ||
      (score === best.score && delta < best.delta) ||
      (score === best.score && delta === best.delta && payment.id < best.payment.id)
    ) {
      best = { payment, score, delta }
    }
  }

  if (!best || best.score < WEAK_THRESHOLD) {
    return { lineId: line.id, suggestedPaymentId: null, confidence: best?.score ?? 0, status: 'UNMATCHED' }
  }
  return {
    lineId: line.id,
    suggestedPaymentId: best.payment.id,
    confidence: best.score,
    status: best.score >= SUGGEST_THRESHOLD ? 'SUGGESTED' : 'WEAK',
  }
}

/** Suggestion for every line. Pure: deterministic for a fixed input. */
export function suggestMatches(
  lines: MatchableLine[],
  candidates: CandidatePayment[],
): LineSuggestion[] {
  const sorted = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return lines.map((line) => bestSuggestion(line, sorted))
}

export const MATCH_THRESHOLDS = { SUGGEST: SUGGEST_THRESHOLD, WEAK: WEAK_THRESHOLD } as const
