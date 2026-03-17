// ─── Calculator ───────────────────────────────────────────────────────────────

export const GST_RATES = [5, 12, 18, 28] as const

export type GstRate = (typeof GST_RATES)[number]

/** Quick percentage presets shown as +/- rows (MyBillBook parity) */
export const PERCENT_PRESETS = [3, 5, 18, 40] as const

export const CALCULATOR_MAX_DIGITS = 15
export const CALCULATOR_MAX_HISTORY = 10

/** localStorage key for calculator preferences */
export const CALCULATOR_SETTINGS_KEY = 'hisaab:calculator-settings'

export const DEFAULT_CALCULATOR_SETTINGS = {
  keyboardSound: true,
  keyboardVibration: true,
} as const
