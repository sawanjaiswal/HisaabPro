/** Voice Entry — Type definitions */

export type VoiceIntent = 'expense' | 'income'

export type VoicePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD'

/** Result of parsing a spoken/typed transcript into a draft money entry. */
export interface ParsedVoiceEntry {
  intent: VoiceIntent
  /** null when no amount could be extracted — the page blocks save until set. */
  amountPaise: number | null
  paymentMode: VoicePaymentMode
  /** Free-text category guess (used for income; expense leaves categoryId empty). */
  category: string | null
  /** Human notes — the cleaned transcript. */
  notes: string
  /** YYYY-MM-DD (local). */
  dateISO: string
  /** Original transcript, untouched. */
  rawTranscript: string
  /** 0..1 — how confident the parse is (drives the preview warning). */
  confidence: number
}

export type SpeechStatus = 'idle' | 'listening' | 'denied' | 'unsupported' | 'error'

export interface SpeechRecognitionState {
  status: SpeechStatus
  transcript: string
  isSupported: boolean
}
