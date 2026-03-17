/** Settings — Calculator hook
 *
 * Pure UI state — no API calls.
 * Thin composition: wires feedback, state transitions (from reducer),
 * and settings persistence (from utils) into React callbacks.
 */

import { useState, useCallback, useRef } from 'react'
import type { CalculatorState, CalculatorSettings } from './settings.types'
import {
  loadSettings,
  saveSettings,
  playClickSound,
  triggerVibration,
} from './calculator-settings.utils'
import {
  INITIAL_STATE,
  reduceKeyPress,
  reduceOperator,
  reduceEquals,
  reduceClear,
  reduceBackspace,
  reducePercent,
  reduceSetGstRate,
  reduceToggleGstMode,
  reduceGT,
  reduceMU,
  reducePercentPreset,
  reduceGstPreset,
} from './calculator.reducer'

// ─── Custom events — wired by payment flow when available ────────────────────

export const CASH_IN_EVENT = 'calculator:cash-in'
export const CASH_OUT_EVENT = 'calculator:cash-out'

// ─── Return type ─────────────────────────────────────────────────────────────

interface UseCalculatorReturn {
  state: CalculatorState
  settings: CalculatorSettings
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
  pressGT: () => void
  pressMU: () => void
  applyPercentPreset: (percent: number, direction: 'add' | 'subtract') => void
  applyGstPreset: (direction: 'add' | 'subtract') => void
  cashIn: () => void
  cashOut: () => void
  pasteToField: () => void
  copyToClipboard: () => void
  toggleSound: () => void
  toggleVibration: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCalculator(): UseCalculatorReturn {
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE)
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<CalculatorSettings>(loadSettings)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const feedback = useCallback(() => {
    if (settingsRef.current.keyboardSound) playClickSound()
    if (settingsRef.current.keyboardVibration) triggerVibration()
  }, [])

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  // ─── Key / operator / equals / clear / backspace / percent ──────────────

  const pressKey = useCallback((char: string) => {
    feedback()
    setState((prev) => reduceKeyPress(prev, char))
  }, [feedback])

  const pressOperator = useCallback((op: '+' | '-' | '*' | '/') => {
    feedback()
    setState((prev) => reduceOperator(prev, op))
  }, [feedback])

  const pressEquals = useCallback(() => {
    feedback()
    setState((prev) => reduceEquals(prev))
  }, [feedback])

  const pressClear = useCallback(() => {
    feedback()
    setState((prev) => reduceClear(prev))
  }, [feedback])

  const pressBackspace = useCallback(() => {
    feedback()
    setState((prev) => reduceBackspace(prev))
  }, [feedback])

  const pressPercent = useCallback(() => {
    feedback()
    setState((prev) => reducePercent(prev))
  }, [feedback])

  // ─── GST / GT / MU / presets ────────────────────────────────────────────

  const setGstRate = useCallback((rate: number) => {
    feedback()
    setState((prev) => reduceSetGstRate(prev, rate))
  }, [feedback])

  const toggleGstMode = useCallback(() => {
    feedback()
    setState((prev) => reduceToggleGstMode(prev))
  }, [feedback])

  const pressGT = useCallback(() => {
    feedback()
    setState((prev) => reduceGT(prev))
  }, [feedback])

  const pressMU = useCallback(() => {
    feedback()
    setState((prev) => reduceMU(prev))
  }, [feedback])

  const applyPercentPreset = useCallback((percent: number, direction: 'add' | 'subtract') => {
    feedback()
    setState((prev) => reducePercentPreset(prev, percent, direction))
  }, [feedback])

  const applyGstPreset = useCallback((direction: 'add' | 'subtract') => {
    feedback()
    setState((prev) => reduceGstPreset(prev, direction))
  }, [feedback])

  // ─── Cash IN / OUT ──────────────────────────────────────────────────────

  const cashIn = useCallback(() => {
    feedback()
    const value = state.result !== null ? state.result : parseFloat(state.display)
    if (!Number.isNaN(value) && value > 0) {
      window.dispatchEvent(new CustomEvent(CASH_IN_EVENT, { detail: { amount: value } }))
    }
  }, [feedback, state.display, state.result])

  const cashOut = useCallback(() => {
    feedback()
    const value = state.result !== null ? state.result : parseFloat(state.display)
    if (!Number.isNaN(value) && value > 0) {
      window.dispatchEvent(new CustomEvent(CASH_OUT_EVENT, { detail: { amount: value } }))
    }
  }, [feedback, state.display, state.result])

  // ─── Clipboard / paste ──────────────────────────────────────────────────

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

  const copyToClipboard = useCallback(() => {
    const value = state.result !== null ? String(state.result) : state.display
    navigator.clipboard.writeText(value).catch(() => {
      // fail silently
    })
  }, [state.display, state.result])

  // ─── Settings toggles ──────────────────────────────────────────────────

  const toggleSound = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, keyboardSound: !prev.keyboardSound }
      saveSettings(next)
      return next
    })
  }, [])

  const toggleVibration = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, keyboardVibration: !prev.keyboardVibration }
      saveSettings(next)
      return next
    })
  }, [])

  return {
    state, settings, isOpen, toggle,
    pressKey, pressOperator, pressEquals, pressClear,
    pressBackspace, pressPercent,
    setGstRate, toggleGstMode, pressGT, pressMU,
    applyPercentPreset, applyGstPreset,
    cashIn, cashOut, pasteToField, copyToClipboard,
    toggleSound, toggleVibration,
  }
}
