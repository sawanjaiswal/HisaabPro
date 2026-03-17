import type { GstMode } from './settings.types'

// ─── Percentage & Markup ─────────────────────────────────────────────────

/**
 * Applies a percentage add or subtract to an amount.
 * +18% on 1000 → 1180, -18% on 1000 → 820
 */
export function applyPercentage(
  amount: number,
  percent: number,
  direction: 'add' | 'subtract',
): number {
  const factor = percent / 100
  if (direction === 'add') return Math.round(amount * (1 + factor))
  return Math.round(amount * (1 - factor))
}

/**
 * Calculates selling price from cost and markup margin percentage.
 * Formula: sellingPrice = cost / (1 - margin/100)
 * Example: cost=100, margin=20 → 125
 * Returns null if margin >= 100 (division by zero).
 */
export function calculateMarkup(cost: number, marginPercent: number): number | null {
  if (marginPercent >= 100) return null
  return Math.round(cost / (1 - marginPercent / 100))
}

// ─── GST Calculation ─────────────────────────────────────────────────────────

/**
 * Calculates GST components.  All inputs are plain numbers (the caller is
 * responsible for converting from / to paise as needed).
 *
 * exclusive: amount is base, GST is added on top.
 * inclusive: amount already contains GST, extract the base.
 *
 * Returns rounded integers so results can be stored in paise without
 * floating-point drift.
 */
export function calculateGst(
  amount: number,
  rate: number,
  mode: GstMode,
): { base: number; gst: number; total: number } {
  if (mode === 'exclusive') {
    const gst = Math.round((amount * rate) / 100)
    return { base: amount, gst, total: amount + gst }
  }

  // inclusive: base = amount / (1 + rate/100)
  const base = Math.round(amount / (1 + rate / 100))
  const gst = amount - base
  return { base, gst, total: amount }
}

// ─── Expression Evaluator ─────────────────────────────────────────────────────

/**
 * Evaluates a simple arithmetic expression string without using eval().
 * Supports: +  -  *  /  % (percentage of left operand)
 * Operator precedence: * and / before + and -
 * Returns null for invalid input.
 *
 * Examples:
 *   evaluateExpression("2 + 3 * 4")  → 14
 *   evaluateExpression("100 + 18%")  → 118
 *   evaluateExpression("10 / 0")     → null
 */
export function evaluateExpression(expression: string): number | null {
  const trimmed = expression.trim()
  if (trimmed === '') return null

  // Tokenise into numbers and operators
  // Supports optional spaces, decimal numbers, and the % suffix
  const tokenRegex = /(\d+(?:\.\d+)?%?|[+\-*/])/g
  const rawTokens = trimmed.match(tokenRegex)
  if (!rawTokens || rawTokens.length === 0) return null

  // Convert percentage tokens: "18%" following an operator means
  // "18% of the preceding number", resolved during the + / - pass.
  // We store tokens as { type: 'num' | 'op', value: number | string }
  type NumToken = { type: 'num'; value: number; isPct: boolean }
  type OpToken  = { type: 'op';  value: string }
  type Token    = NumToken | OpToken

  const tokens: Token[] = rawTokens.map((t) => {
    if (t === '+' || t === '-' || t === '*' || t === '/') {
      return { type: 'op', value: t }
    }
    if (t.endsWith('%')) {
      return { type: 'num', value: parseFloat(t) / 100, isPct: true }
    }
    return { type: 'num', value: parseFloat(t), isPct: false }
  })

  // Must start and end with a number token
  if (tokens[0].type !== 'num' || tokens[tokens.length - 1].type !== 'num') {
    return null
  }

  // Pass 1: resolve * and / left-to-right, collapse into single-value tokens
  const pass1: Token[] = [tokens[0]]

  for (let i = 1; i < tokens.length; i += 2) {
    const op  = tokens[i]
    const rhs = tokens[i + 1]

    if (!op || !rhs || op.type !== 'op' || rhs.type !== 'num') return null

    if (op.value === '*' || op.value === '/') {
      const lhsToken = pass1[pass1.length - 1] as NumToken
      if (op.value === '/') {
        if (rhs.value === 0) return null
        pass1[pass1.length - 1] = {
          type: 'num',
          value: lhsToken.value / rhs.value,
          isPct: false,
        }
      } else {
        pass1[pass1.length - 1] = {
          type: 'num',
          value: lhsToken.value * rhs.value,
          isPct: false,
        }
      }
    } else {
      // + or - — defer to pass 2
      pass1.push(op, rhs)
    }
  }

  // Pass 2: resolve + and - left-to-right
  let result = (pass1[0] as NumToken).value

  for (let i = 1; i < pass1.length; i += 2) {
    const op  = pass1[i] as OpToken
    const rhs = pass1[i + 1] as NumToken

    if (!op || !rhs) return null

    // % suffix on rhs means "percent of current result"
    const rhsValue = rhs.isPct ? result * rhs.value : rhs.value

    if (op.value === '+') result += rhsValue
    else if (op.value === '-') result -= rhsValue
    else return null
  }

  return Number.isFinite(result) ? result : null
}
