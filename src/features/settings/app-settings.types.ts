// ─── App Settings ────────────────────────────────────────────────────────────

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

export type CalculatorPosition = 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'

export interface AppSettings {
  dateFormat: DateFormat
  pinEnabled: boolean
  biometricEnabled: boolean
  operationPinSet: boolean
  calculatorPosition: CalculatorPosition
  language: string
  theme: 'light' | 'dark'
}

export interface AppSettingsResponse {
  success: boolean
  data: AppSettings
}

// ─── PIN ─────────────────────────────────────────────────────────────────────

export type PinStep = 'enter' | 'confirm' | 'verify' | 'lockout' | 'forgot'

export interface PinState {
  step: PinStep
  pin: string
  confirmPin: string
  attemptsRemaining: number
  lockedUntil: string | null
  error: string | null
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  label: string
}

export type ShortcutGroup = 'billing' | 'navigation'

// ─── Calculator ──────────────────────────────────────────────────────────────

export type CalculatorMode = 'basic' | 'gst'

export type GstMode = 'exclusive' | 'inclusive'

export interface CalculatorState {
  display: string
  expression: string
  result: number | null
  history: Array<{ expression: string; result: number }>
  mode: CalculatorMode
  gstRate: number | null
  gstMode: GstMode
  /** Grand Total — accumulates results from each = press */
  grandTotal: number
  /** Markup mode: when true, next = computes selling price from cost + margin% */
  muBase: number | null
  /** Last GST breakdown for display */
  lastGstBreakdown: { base: number; gst: number; total: number } | null
}

export interface CalculatorSettings {
  keyboardSound: boolean
  keyboardVibration: boolean
}

// ─── Settings Hub ────────────────────────────────────────────────────────────

export interface SettingsSection {
  id: string
  title: string
  items: SettingsItem[]
}

export interface SettingsItem {
  id: string
  label: string
  description?: string
  icon: string
  route?: string
  type: 'navigation' | 'toggle' | 'select'
  value?: string | boolean
}
