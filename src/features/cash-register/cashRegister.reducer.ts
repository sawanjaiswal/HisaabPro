/** Cash Register — Expression keypad state machine */

import { MAX_EXPRESSION_LEN, OPERATORS } from './cashRegister.constants'
import type { ExpressionState, ExpressionAction } from './cashRegister.types'

// ─── Initial state ────────────────────────────────────────────────────────────

export const EXPRESSION_INITIAL: ExpressionState = {
  display: '',
  error: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lastNonSpace(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] !== ' ') return s[i]
  }
  return ''
}

function isOperator(ch: string): boolean {
  return OPERATORS.has(ch)
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function expressionReducer(
  state: ExpressionState,
  action: ExpressionAction,
): ExpressionState {
  const { display } = state

  switch (action.type) {
    case 'CLEAR': {
      return EXPRESSION_INITIAL
    }

    case 'BACKSPACE': {
      if (display.length === 0) return state
      return { ...state, display: display.slice(0, -1), error: null }
    }

    case 'APPEND_DIGIT': {
      if (display.length >= MAX_EXPRESSION_LEN) return state
      const { digit } = action

      // Prevent leading multiple zeros: "0" + "0" = "0"
      if (digit === '0' && display === '0') return state

      // Prevent leading zero before digit: "0" + "5" should become "5"
      if (display === '0' && digit !== '.') {
        return { ...state, display: digit, error: null }
      }

      return { ...state, display: display + digit, error: null }
    }

    case 'APPEND_OPERATOR': {
      if (display.length >= MAX_EXPRESSION_LEN) return state
      const { op } = action

      // Unary minus: allow '-' at start or after '('
      if (op === '-' && (display.length === 0 || display.endsWith('('))) {
        return { ...state, display: display + op, error: null }
      }

      // Cannot start expression with non-unary operator
      if (display.length === 0) return state

      const last = lastNonSpace(display)

      // Replace last operator if already an operator (prevents double-operator)
      if (isOperator(last)) {
        return { ...state, display: display.slice(0, -1) + op, error: null }
      }

      // Cannot place operator right after '('
      if (last === '(') return state

      return { ...state, display: display + op, error: null }
    }

    case 'APPEND_PAREN': {
      if (display.length >= MAX_EXPRESSION_LEN) return state
      const { which } = action

      if (which === '(') {
        // Allow '(' at start, after operator, or after another '('
        const last = lastNonSpace(display)
        if (display.length === 0 || isOperator(last) || last === '(') {
          return { ...state, display: display + '(', error: null }
        }
        return state
      }

      // ')' — only allow if there's an unmatched '('
      const openCount = (display.match(/\(/g) ?? []).length
      const closeCount = (display.match(/\)/g) ?? []).length
      if (openCount <= closeCount) return state

      const last = lastNonSpace(display)
      if (isOperator(last) || last === '(') return state

      return { ...state, display: display + ')', error: null }
    }

    default:
      return state
  }
}
