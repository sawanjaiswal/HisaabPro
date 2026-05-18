/**
 * usePinKeypad — controlled PIN input state.
 *
 * Owns only the value string and the three mutators (append digit, backspace,
 * clear). Length is hard-capped at `maxLen` and non-digit input is silently
 * rejected — these invariants live in the hook so every UI surface (keypad
 * button, keyboard listener, paste handler) gets the same guarantees without
 * each having to re-validate.
 *
 * Why a hook and not setState in the component: the keypad is tested
 * separately from the sheet (the sheet has lifecycle / portal concerns the
 * hook does not), and the hook gives us a clean unit test surface.
 */

import { useCallback, useState } from 'react'

export interface UsePinKeypadResult {
  /** Current PIN value. Always a string of digits, length 0..maxLen. */
  value: string
  /** Append one digit. No-op if value is already at maxLen or input is not a single digit. */
  append: (digit: string) => void
  /** Remove the trailing digit. No-op if value is empty. */
  backspace: () => void
  /** Reset to empty. */
  clear: () => void
}

/**
 * @param maxLen Maximum digits accepted (typically PIN_MAX_LEN = 6).
 */
export function usePinKeypad(maxLen: number): UsePinKeypadResult {
  const [value, setValue] = useState<string>('')

  const append = useCallback(
    (digit: string) => {
      // Reject anything that isn't exactly one ASCII digit. Defense in depth:
      // the keypad buttons only emit digits, but a paste handler or stray
      // keypress could try to push longer strings or non-digit chars.
      if (digit.length !== 1) return
      if (digit < '0' || digit > '9') return
      setValue((prev) => (prev.length >= maxLen ? prev : prev + digit))
    },
    [maxLen],
  )

  const backspace = useCallback(() => {
    setValue((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)))
  }, [])

  const clear = useCallback(() => {
    setValue('')
  }, [])

  return { value, append, backspace, clear }
}
