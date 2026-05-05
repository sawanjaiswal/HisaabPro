/**
 * GST Returns / Backfill — Type definitions
 *
 * Amounts in paise (integer) on the server; rupees (divided by 100) in NIC envelopes.
 */

// ─── NIC v3.0 GSTR-1 Types (PR 10) ─────────────────────────────────────────

export interface Gstr1Summary {
  period: string
  b2b: number
  b2cl: number
  b2cs: number
  cdnr: number
  cdnur: number
  hsn: number
  nil: number
  exp: number
}

export interface Gstr1SummaryRes {
  summary: Gstr1Summary | null
  exportedAt: string | null   // ISO date string
}

export interface Gstr1ExportRes {
  jsonData: Record<string, unknown>
  csvData: string
  summary: Gstr1Summary
}

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

// ─── GSTR-3B (PR 11) ────────────────────────────────────────────────────────

export interface Gstr3bSection {
  section: string
  description: string
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
}

export interface Gstr3bSummary {
  period: string
  sections: Gstr3bSection[]
  netPayable: number
}

export interface Gstr3bSummaryRes {
  summary: Gstr3bSummary | null
  exportedAt: string | null
}

export interface Gstr3bExportRes {
  jsonData: Gstr3bSummary
  csvData: string
  summary: Gstr3bSummary
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
