import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  WEAK_PINS,
} from './settings.constants'

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
