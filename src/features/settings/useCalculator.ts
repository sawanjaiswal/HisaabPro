/** Settings — Calculator hook
 *
 * Pure UI state — no API calls.
 * Manages basic and GST calculation modes, expression history, and
 * visibility (bottom-sheet toggle).
 *
 * Key actions:
 *   pressKey(char)      — append digit or decimal point
 *   pressOperator(op)   — append operator (+, -, *, /)
 *   pressEquals()       — evaluate expression, push to history
 *   pressClear()        — reset all state (AC)
 *   pressBackspace()    — remove last character from display
 *   pressPercent()      — append % suffix to current number
 *   setGstRate(rate)    — set active GST rate
 *   toggleGstMode()     — toggle exclusive / inclusive
 *   pasteToField()      — write display value into focused input
 *   copyToClipboard()   — copy display value to clipboard
 *   toggle()            — open / close bottom sheet
 */

import { useState, useCallback } from 'react'
import { CALCULATOR_MAX_DIGITS, CALCULATOR_MAX_HISTORY } from './settings.constants'
import { evaluateExpression, calculateGst } from './settings.utils'
import type { CalculatorState, CalculatorMode, GstMode } from './settings.types'

interface UseCalculatorReturn {
  state: CalculatorState
  isOpen: boolean
  toggle: () => void
  pressKey: (char: string) => void
  pressOperator: (op: '+' | '-' | '*' | '/') => void
  pressEquals: () => void
  pressClear: () => void
  pressBackspace: () => void
  pressPercent: () => void
  setGstRate: (rate: number) => void
  toggleGstMode: () => void
  pasteToField: () => void
  copyToClipboard: () => void
}

const INITIAL_STATE: CalculatorState = {
  display: '0',
  expression: '',
  result: null,
  history: [],
  mode: 'basic',
  gstRate: 18,
  gstMode: 'exclusive',
}

/** Returns true if the last token in display ends with a digit or decimal */
function endsWithOperand(display: string): boolean {
  return /[\d.]$/.test(display)
}

/** Returns true if the display is the leading zero placeholder */
function isZeroDisplay(display: string): boolean {
  return display === '0'
}

export function useCalculator(): UseCalculatorReturn {
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE)
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  // ─── Key press (digit or decimal) ───────────────────────────────────────────

  const pressKey = useCallback((char: string) => {
    setState((prev) => {
      // After a completed result, start a fresh expression
      const startFresh = prev.result !== null

      // Enforce max digits per number token (count digits only, not operators)
      const currentNumber = prev.display.split(/[+\-*/]/).pop() ?? ''
      const digitCount = (currentNumber.match(/\d/g) ?? []).length
      if (char !== '.' && digitCount >= CALCULATOR_MAX_DIGITS) return prev

      // Prevent duplicate decimal
      if (char === '.' && currentNumber.includes('.')) return prev

      let nextDisplay: string
      if (startFresh) {
        nextDisplay = char === '.' ? '0.' : char
      } else if (isZeroDisplay(prev.display) && char !== '.') {
        nextDisplay = char
      } else {
        nextDisplay = prev.display + char
      }

      return {
        ...prev,
        display: nextDisplay,
        expression: startFresh ? nextDisplay : prev.expression,
        result: null,
      }
    })
  }, [])

  // ─── Operator press ──────────────────────────────────────────────────────────

  const pressOperator = useCallback((op: '+' | '-' | '*' | '/') => {
    setState((prev) => {
      // Replace trailing operator if already ends with one
      if (!endsWithOperand(prev.display)) {
        const replaced = prev.display.slice(0, -1) + op
        return { ...prev, display: replaced, expression: replaced, result: null }
      }

      const next = prev.display + op
      return { ...prev, display: next, expression: next, result: null }
    })
  }, [])

  // ─── Equals ──────────────────────────────────────────────────────────────────

  const pressEquals = useCallback(() => {
    setState((prev) => {
      const expr = prev.display

      if (!endsWithOperand(expr)) return prev

      if (prev.mode === 'gst') {
        // In GST mode evaluate arithmetic first, then apply GST
        const base = evaluateExpression(expr)
        if (base === null || prev.gstRate === null) return prev

        const { total } = calculateGst(base, prev.gstRate, prev.gstMode)
        const historyEntry = { expression: `${expr} (GST ${prev.gstRate}%)`, result: total }

        return {
          ...prev,
          display: String(total),
          result: total,
          history: [historyEntry, ...prev.history].slice(0, CALCULATOR_MAX_HISTORY),
        }
      }

      // Basic mode
      const result = evaluateExpression(expr)
      if (result === null) return prev

      const historyEntry = { expression: expr, result }

      return {
        ...prev,
        display: String(result),
        result,
        history: [historyEntry, ...prev.history].slice(0, CALCULATOR_MAX_HISTORY),
      }
    })
  }, [])

  // ─── Clear (AC) ──────────────────────────────────────────────────────────────

  const pressClear = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      mode: prev.mode,
      gstRate: prev.gstRate,
      gstMode: prev.gstMode,
      history: prev.history,
    }))
  }, [])

  // ─── Backspace ───────────────────────────────────────────────────────────────

  const pressBackspace = useCallback(() => {
    setState((prev) => {
      if (prev.result !== null) {
        // Clear the finished result — same as AC
        return {
          ...prev,
          display: '0',
          expression: '',
          result: null,
        }
      }

      const next = prev.display.length <= 1 ? '0' : prev.display.slice(0, -1)
      return { ...prev, display: next, expression: next }
    })
  }, [])

  // ─── Percent suffix ──────────────────────────────────────────────────────────

  const pressPercent = useCallback(() => {
    setState((prev) => {
      if (!endsWithOperand(prev.display)) return prev
      if (prev.display.endsWith('%')) return prev
      const next = prev.display + '%'
      return { ...prev, display: next, expression: next, result: null }
    })
  }, [])

  // ─── GST rate ────────────────────────────────────────────────────────────────

  const setGstRate = useCallback((rate: number) => {
    setState((prev) => ({
      ...prev,
      gstRate: rate,
      mode: 'gst' as CalculatorMode,
    }))
  }, [])

  // ─── GST mode toggle ─────────────────────────────────────────────────────────

  const toggleGstMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      gstMode: (prev.gstMode === 'exclusive' ? 'inclusive' : 'exclusive') as GstMode,
    }))
  }, [])

  // ─── Paste to focused input ───────────────────────────────────────────────────

  const pasteToField = useCallback(() => {
    const value = state.result !== null ? String(state.result) : state.display
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        active instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype,
        'value',
      )?.set
      nativeInputValueSetter?.call(active, value)
      active.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, [state.display, state.result])

  // ─── Copy to clipboard ───────────────────────────────────────────────────────

  const copyToClipboard = useCallback(() => {
    const value = state.result !== null ? String(state.result) : state.display
    navigator.clipboard.writeText(value).catch(() => {
      // Clipboard write can be denied — fail silently; user sees display value
    })
  }, [state.display, state.result])

  return {
    state,
    isOpen,
    toggle,
    pressKey,
    pressOperator,
    pressEquals,
    pressClear,
    pressBackspace,
    pressPercent,
    setGstRate,
    toggleGstMode,
    pasteToField,
    copyToClipboard,
  }
}
