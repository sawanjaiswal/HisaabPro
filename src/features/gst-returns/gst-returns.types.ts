/**
 * GST Returns / Backfill — Type definitions
 *
 * Amounts in paise (integer). Do not use floating-point math.
 */

export interface BackfillPreviewRes {
  untaggedProductCount: number
  untaggedProductValue: number      // paise
  nullPosInvoiceCount: number
  nullPosTaxableValue: number       // paise
}

export interface BackfillExecutePayload {
  defaultTaxCategoryId: string
  dateRange: [string, string]       // ISO date strings
  setPositionFromParty: boolean
}

export interface BackfillExecuteRes {
  jobId: string
  status: 'RUNNING'
}

export interface BackfillStatusRes {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  processed: number
  total: number
  errors: BackfillError[]
}

export interface BackfillError {
  entityId: string
  entityType: string
  message: string
}

// ─── Wizard state machine ────────────────────────────────────────────────────

export type WizardStep =
  | 'preview'
  | 'options'
  | 'confirmation'
  | 'processing'
  | 'complete'

export interface WizardOptions {
  defaultTaxCategoryId: string
  setPositionFromParty: boolean
  dateRange: [Date, Date]
}

export type WizardState =
  | { step: 'preview'; preview: BackfillPreviewRes | null; loading: boolean; error: string | null }
  | { step: 'options'; options: WizardOptions; preview: BackfillPreviewRes }
  | { step: 'confirmation'; options: WizardOptions; preview: BackfillPreviewRes }
  | { step: 'processing'; jobId: string; options: WizardOptions; preview: BackfillPreviewRes }
  | { step: 'complete'; jobId: string; status: BackfillStatusRes }

export type WizardAction =
  | { type: 'PREVIEW_START' }
  | { type: 'PREVIEW_SUCCESS'; preview: BackfillPreviewRes }
  | { type: 'PREVIEW_ERROR'; error: string }
  | { type: 'GO_OPTIONS'; options: WizardOptions }
  | { type: 'GO_CONFIRMATION' }
  | { type: 'BACK' }
  | { type: 'START_PROCESSING'; jobId: string }
  | { type: 'COMPLETE'; status: BackfillStatusRes }
