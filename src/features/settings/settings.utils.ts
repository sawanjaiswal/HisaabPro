import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  WEAK_PINS,
} from './settings.constants'
import type { GstMode, ShortcutConfig } from './settings.types'

// ─── PIN Validation ───────────────────────────────────────────────────────────

/**
 * Returns whether the PIN string consists only of digits and is within the
 * allowed length range.  Weak PIN detection is separate so callers can decide
 * whether to block or just warn.
 */
export function validatePin(pin: string): {
  valid: boolean
  weak: boolean
  error?: string
} {
  if (!/^\d+$/.test(pin)) {
    return { valid: false, weak: false, error: 'PIN must contain digits only' }
  }

  if (pin.length < PIN_MIN_LENGTH) {
    return {
      valid: false,
      weak: false,
      error: `PIN must be at least ${PIN_MIN_LENGTH} digits`,
    }
  }

  if (pin.length > PIN_MAX_LENGTH) {
    return {
      valid: false,
      weak: false,
      error: `PIN must be at most ${PIN_MAX_LENGTH} digits`,
    }
  }

  const weak = isWeakPin(pin)

  if (weak) {
    return {
      valid: true,   // technically meets length requirements
      weak: true,
      error: 'This PIN is too simple. Use a stronger PIN.',
    }
  }

  return { valid: true, weak: false }
}

/**
 * Returns true when the PIN appears in the known-weak list.
 */
export function isWeakPin(pin: string): boolean {
  return WEAK_PINS.includes(pin)
}

// ─── Permission Key Helpers ───────────────────────────────────────────────────

/**
 * Builds the canonical dot-separated permission key used throughout the app.
 * e.g. formatPermissionKey('invoicing', 'view') → "invoicing.view"
 */
export function formatPermissionKey(module: string, action: string): string {
  return `${module}.${action}`
}

/**
 * Splits a dot-separated key back into its module and action parts.
 * Unknown keys return empty strings so callers can filter gracefully.
 */
export function parsePermissionKey(key: string): {
  module: string
  action: string
} {
  const dotIndex = key.indexOf('.')
  if (dotIndex === -1) return { module: key, action: '' }
  return {
    module: key.slice(0, dotIndex),
    action: key.slice(dotIndex + 1),
  }
}

/**
 * Given a flat permissions array and a module key, counts how many of that
 * module's possible actions are granted compared to how many exist in the
 * provided allModuleActions list.
 *
 * @param permissions  - e.g. ["invoicing.view", "invoicing.create"]
 * @param moduleKey    - e.g. "invoicing"
 * @param totalActions - total number of actions for that module
 */
export function getPermissionCount(
  permissions: string[],
  moduleKey: string,
  totalActions: number,
): { granted: number; total: number } {
  const granted = permissions.filter((p) =>
    p.startsWith(`${moduleKey}.`),
  ).length
  return { granted, total: totalActions }
}

// ─── Transaction Lock Formatting ─────────────────────────────────────────────

/**
 * Returns a human-readable string for a lock period value.
 * null means the feature is disabled ("Never").
 */
export function formatLockPeriod(days: number | null): string {
  if (days === null) return 'Never'
  if (days === 1) return '1 day'
  return `${days} days`
}

// ─── Time Ago ─────────────────────────────────────────────────────────────────

/**
 * Returns a short, human-friendly relative time string.
 * All comparisons are done in UTC using Date.parse so there is no dependency
 * on external libraries.
 */
export function formatTimeAgo(iso: string): string {
  const now = Date.now()
  const then = Date.parse(iso)

  if (Number.isNaN(then)) return '—'

  const diffMs = now - then

  if (diffMs < 0) return 'Just now'               // clock skew guard
  if (diffMs < 60_000) return 'Just now'           // < 1 min
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000)
    return `${mins}m ago`
  }
  if (diffMs < 86_400_000) {
    const hrs = Math.floor(diffMs / 3_600_000)
    return `${hrs}h ago`
  }
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 30) return `${days}d ago`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  }
  const years = Math.floor(days / 365)
  return `${years}y ago`
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

// ─── Keyboard Shortcut Formatting ────────────────────────────────────────────

/**
 * Returns a display string for a shortcut config.
 * e.g. { key: 'n', ctrl: true } → "Ctrl + N"
 */
export function formatShortcutKey(config: ShortcutConfig): string {
  const parts: string[] = []

  if (config.ctrl)  parts.push('Ctrl')
  if (config.alt)   parts.push('Alt')
  if (config.shift) parts.push('Shift')

  // Special key display names
  const KEY_DISPLAY: Record<string, string> = {
    Enter:  'Enter',
    Escape: 'Esc',
    Tab:    'Tab',
    ' ':    'Space',
  }

  const keyLabel = KEY_DISPLAY[config.key] ?? config.key.toUpperCase()
  parts.push(keyLabel)

  return parts.join(' + ')
}
