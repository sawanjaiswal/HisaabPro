/** Calculator — Pure state transition functions
 *
 * Each function takes the current CalculatorState + action data
 * and returns the next state. No React, no hooks, no side effects.
 */

import { CALCULATOR_MAX_DIGITS, CALCULATOR_MAX_HISTORY } from './calculator.constants'
import {
  evaluateExpression,
  calculateGst,
  applyPercentage,
  calculateMarkup,
} from './settings.utils'
import type {
  CalculatorState,
  CalculatorMode,
  GstMode,
} from './settings.types'

// ─── Initial state ───────────────────────────────────────────────────────────

export const INITIAL_STATE: CalculatorState = {
  display: '0',
  expression: '',
  result: null,
  history: [],
  mode: 'basic',
  gstRate: 18,
  gstMode: 'exclusive',
  grandTotal: 0,
  muBase: null,
  lastGstBreakdown: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function endsWithOperand(display: string): boolean {
  return /[\d.]$/.test(display)
}

function isZeroDisplay(display: string): boolean {
  return display === '0'
}

// ─── State transitions (pure) ────────────────────────────────────────────────

export function reduceKeyPress(prev: CalculatorState, char: string): CalculatorState {
  const startFresh = prev.result !== null
  const currentNumber = prev.display.split(/[+\-*/]/).pop() ?? ''
  const digitCount = (currentNumber.match(/\d/g) ?? []).length
  if (char !== '.' && digitCount >= CALCULATOR_MAX_DIGITS) return prev
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
    lastGstBreakdown: null,
  }
}

export function reduceOperator(prev: CalculatorState, op: '+' | '-' | '*' | '/'): CalculatorState {
  if (!endsWithOperand(prev.display)) {
    const replaced = prev.display.slice(0, -1) + op
    return { ...prev, display: replaced, expression: replaced, result: null }
  }
  const next = prev.display + op
  return { ...prev, display: next, expression: next, result: null }
}

export function reduceEquals(prev: CalculatorState): CalculatorState {
  const expr = prev.display
  if (!endsWithOperand(expr)) return prev

  // MU mode: display contains margin%, apply markup to stored base
  if (prev.muBase !== null) {
    const margin = parseFloat(expr)
    if (Number.isNaN(margin)) return prev
    const sellingPrice = calculateMarkup(prev.muBase, margin)
    if (sellingPrice === null) return prev

    const historyEntry = { expression: `MU: ${prev.muBase} @ ${margin}%`, result: sellingPrice }
    return {
      ...prev,
      display: String(sellingPrice),
      result: sellingPrice,
      muBase: null,
      grandTotal: prev.grandTotal + sellingPrice,
      history: [historyEntry, ...prev.history].slice(0, CALCULATOR_MAX_HISTORY),
    }
  }

  // GST mode
  if (prev.mode === 'gst') {
    const base = evaluateExpression(expr)
    if (base === null || prev.gstRate === null) return prev
    const gstBreakdown = calculateGst(base, prev.gstRate, prev.gstMode)
    const historyEntry = { expression: `${expr} (GST ${prev.gstRate}%)`, result: gstBreakdown.total }
    return {
      ...prev,
      display: String(gstBreakdown.total),
      result: gstBreakdown.total,
      grandTotal: prev.grandTotal + gstBreakdown.total,
      lastGstBreakdown: gstBreakdown,
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
    grandTotal: prev.grandTotal + result,
    history: [historyEntry, ...prev.history].slice(0, CALCULATOR_MAX_HISTORY),
  }
}

export function reduceClear(prev: CalculatorState): CalculatorState {
  return {
    ...INITIAL_STATE,
    mode: prev.mode,
    gstRate: prev.gstRate,
    gstMode: prev.gstMode,
    grandTotal: prev.grandTotal,
    history: prev.history,
  }
}

export function reduceBackspace(prev: CalculatorState): CalculatorState {
  if (prev.result !== null) {
    return { ...prev, display: '0', expression: '', result: null, lastGstBreakdown: null }
  }
  const next = prev.display.length <= 1 ? '0' : prev.display.slice(0, -1)
  return { ...prev, display: next, expression: next }
}

export function reducePercent(prev: CalculatorState): CalculatorState {
  if (!endsWithOperand(prev.display)) return prev
  if (prev.display.endsWith('%')) return prev
  const next = prev.display + '%'
  return { ...prev, display: next, expression: next, result: null }
}

export function reduceSetGstRate(prev: CalculatorState, rate: number): CalculatorState {
  return { ...prev, gstRate: rate, mode: 'gst' as CalculatorMode }
}

export function reduceToggleGstMode(prev: CalculatorState): CalculatorState {
  return {
    ...prev,
    gstMode: (prev.gstMode === 'exclusive' ? 'inclusive' : 'exclusive') as GstMode,
  }
}

export function reduceGT(prev: CalculatorState): CalculatorState {
  return {
    ...prev,
    display: String(prev.grandTotal),
    expression: `GT = ${prev.grandTotal}`,
    result: prev.grandTotal,
  }
}

export function reduceMU(prev: CalculatorState): CalculatorState {
  const currentValue = prev.result ?? parseFloat(prev.display)
  if (Number.isNaN(currentValue) || currentValue === 0) return prev
  return {
    ...prev,
    muBase: currentValue,
    display: '0',
    expression: `MU: ${currentValue} @ ?%`,
    result: null,
  }
}

export function reducePercentPreset(
  prev: CalculatorState,
  percent: number,
  direction: 'add' | 'subtract',
): CalculatorState {
  const currentValue = prev.result ?? parseFloat(prev.display)
  if (Number.isNaN(currentValue) || currentValue === 0) return prev
  const newValue = applyPercentage(currentValue, percent, direction)
  const sign = direction === 'add' ? '+' : '-'
  return {
    ...prev,
    display: String(newValue),
    expression: `${currentValue} ${sign} ${percent}%`,
    result: newValue,
    lastGstBreakdown: null,
  }
}

export function reduceGstPreset(prev: CalculatorState, direction: 'add' | 'subtract'): CalculatorState {
  const currentValue = prev.result ?? parseFloat(prev.display)
  if (Number.isNaN(currentValue) || currentValue === 0 || prev.gstRate === null) return prev
  const gstMode: GstMode = direction === 'add' ? 'exclusive' : 'inclusive'
  const breakdown = calculateGst(currentValue, prev.gstRate, gstMode)
  const resultVal = direction === 'add' ? breakdown.total : breakdown.base
  const sign = direction === 'add' ? '+' : '-'
  return {
    ...prev,
    display: String(resultVal),
    expression: `${currentValue} ${sign} GST ${prev.gstRate}%`,
    result: resultVal,
    mode: 'gst' as CalculatorMode,
    lastGstBreakdown: breakdown,
  }
}
