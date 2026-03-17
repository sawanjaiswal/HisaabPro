/** Calculator — Settings persistence & feedback helpers
 *
 * Pure side-effect utilities: localStorage for preferences,
 * AudioContext for click sound, Vibration API for haptics.
 */

import {
  CALCULATOR_SETTINGS_KEY,
  DEFAULT_CALCULATOR_SETTINGS,
} from './calculator.constants'
import type { CalculatorSettings } from './settings.types'

// ─── Settings (localStorage-backed) ──────────────────────────────────────────

export function loadSettings(): CalculatorSettings {
  try {
    const raw = localStorage.getItem(CALCULATOR_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CalculatorSettings>
      return { ...DEFAULT_CALCULATOR_SETTINGS, ...parsed }
    }
  } catch {
    // corrupt data — use defaults
  }
  return { ...DEFAULT_CALCULATOR_SETTINGS }
}

export function saveSettings(settings: CalculatorSettings): void {
  try {
    localStorage.setItem(CALCULATOR_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // quota exceeded — silently fail
  }
}

// ─── Haptic & sound feedback ─────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

export function playClickSound(): void {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.value = 1200
    gain.gain.value = 0.05
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.06)
  } catch {
    // AudioContext not available
  }
}

export function triggerVibration(): void {
  try {
    if (navigator.vibrate) navigator.vibrate(10)
  } catch {
    // Vibration API not available
  }
}
