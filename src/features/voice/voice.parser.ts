/** Voice Entry — pure transcript parser (the testable core).
 *
 * No browser APIs, no I/O. Takes a raw transcript string and returns a
 * ParsedVoiceEntry draft. Handles Indian money phrasing in Hindi + English
 * ("do hazaar paanch sau", "1.5 lakh", "₹500 cash", "rent mila 5000 upi").
 */

import { toLocalISODate } from '@/lib/format'
import type { ParsedVoiceEntry, VoiceIntent, VoicePaymentMode } from './voice.types'
import {
  EXPENSE_KEYWORDS, INCOME_KEYWORDS, PAYMENT_MODE_KEYWORDS, INCOME_CATEGORY_KEYWORDS,
  CURRENCY_TOKENS, SCALE_WORDS, NUMBER_WORDS, FRACTION_WORDS, DATE_OFFSET_WORDS,
} from './voice.constants'

function normalize(text: string): string {
  return text.toLowerCase().replace(/[,]/g, '').replace(/\s+/g, ' ').trim()
}

function tokenize(norm: string): string[] {
  return norm.split(/[^\p{L}\p{N}.]+/u).filter(Boolean)
}

/** Detect intent; returns expense by default (most common) when ambiguous. */
export function detectIntent(norm: string): { intent: VoiceIntent; explicit: boolean } {
  const hasIncome = INCOME_KEYWORDS.some((k) => norm.includes(k))
  const hasExpense = EXPENSE_KEYWORDS.some((k) => norm.includes(k))
  if (hasIncome && !hasExpense) return { intent: 'income', explicit: true }
  if (hasExpense && !hasIncome) return { intent: 'expense', explicit: true }
  return { intent: 'expense', explicit: false }
}

export function detectPaymentMode(norm: string): { mode: VoicePaymentMode; explicit: boolean } {
  for (const [words, mode] of PAYMENT_MODE_KEYWORDS) {
    if (words.some((w) => norm.includes(w))) return { mode, explicit: true }
  }
  return { mode: 'CASH', explicit: false }
}

export function guessIncomeCategory(norm: string): string | null {
  for (const [words, label] of INCOME_CATEGORY_KEYWORDS) {
    if (words.some((w) => norm.includes(w))) return label
  }
  return null
}

export function detectDateISO(norm: string, now: Date = new Date()): string {
  for (const [words, offset] of DATE_OFFSET_WORDS) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`, 'u').test(norm))) {
      const d = new Date(now)
      d.setDate(d.getDate() + offset)
      return toLocalISODate(d)
    }
  }
  return toLocalISODate(now)
}

/**
 * Parse an amount in RUPEES from a transcript. Returns rupees (float) or null.
 * Strategy: prefer an explicit digit run (optionally with a scale word after),
 * else fall back to spelled-out number words.
 */
export function parseAmountRupees(norm: string): number | null {
  const cleaned = stripCurrency(norm.replace(/,/g, ''))

  // 1) digits, optional decimal, optional trailing scale word ("1.5 lakh", "500", "2 hazaar")
  const digitMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([a-z]+)?/)
  if (digitMatch) {
    const base = parseFloat(digitMatch[1])
    const scale = digitMatch[2] && SCALE_WORDS[digitMatch[2]] ? SCALE_WORDS[digitMatch[2]] : 1
    if (Number.isFinite(base) && base > 0) return base * scale
  }

  // 2) spelled-out words ("do hazaar paanch sau", "dhai lakh")
  const fromWords = parseWordNumber(cleaned)
  return fromWords && fromWords > 0 ? fromWords : null
}

function stripCurrency(norm: string): string {
  let out = ` ${norm} `
  for (const tok of CURRENCY_TOKENS) {
    out = out.split(tok).join(' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

/** Accumulate spelled-out Indian number words into a single value. */
export function parseWordNumber(norm: string): number | null {
  const tokens = tokenize(norm)
  let total = 0
  let current = 0
  let pendingFraction: number | null = null
  let sawAny = false

  for (const tok of tokens) {
    if (FRACTION_WORDS[tok] !== undefined) {
      pendingFraction = FRACTION_WORDS[tok]
      sawAny = true
      continue
    }
    if (NUMBER_WORDS[tok] !== undefined) {
      current += NUMBER_WORDS[tok]
      sawAny = true
      continue
    }
    if (SCALE_WORDS[tok] !== undefined) {
      const scale = SCALE_WORDS[tok]
      const multiplier = pendingFraction ?? (current || 1)
      const value = multiplier * scale
      if (scale >= 1000) {
        total += value
        current = 0
      } else {
        // "sau"/hundred multiplies the running unit but stays in `current`
        current = value
      }
      pendingFraction = null
      sawAny = true
      continue
    }
    // unknown token — ignore
  }

  if (!sawAny) return null
  return total + current
}

/** Confidence heuristic: amount present + explicit intent/mode raise it. */
function scoreConfidence(hasAmount: boolean, intentExplicit: boolean, modeExplicit: boolean): number {
  let c = 0.3
  if (hasAmount) c += 0.4
  if (intentExplicit) c += 0.2
  if (modeExplicit) c += 0.1
  return Math.min(1, Number(c.toFixed(2)))
}

export function parseVoiceEntry(rawTranscript: string, now: Date = new Date()): ParsedVoiceEntry {
  const norm = normalize(rawTranscript)
  const { intent, explicit: intentExplicit } = detectIntent(norm)
  const { mode, explicit: modeExplicit } = detectPaymentMode(norm)
  const rupees = parseAmountRupees(norm)
  const amountPaise = rupees != null ? Math.round(rupees * 100) : null
  const category = intent === 'income' ? guessIncomeCategory(norm) : null

  return {
    intent,
    amountPaise,
    paymentMode: mode,
    category,
    notes: rawTranscript.trim(),
    dateISO: detectDateISO(norm, now),
    rawTranscript,
    confidence: scoreConfidence(amountPaise != null, intentExplicit, modeExplicit),
  }
}
