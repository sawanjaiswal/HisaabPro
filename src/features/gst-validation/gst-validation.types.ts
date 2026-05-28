/**
 * Frontend mirror of the GST filing-readiness API contract (#144).
 * Keep in sync with server/src/services/gst-validation/gst-validation.types.ts.
 */

export type GstCheckSeverity = 'blocker' | 'warning'

export type GstCheckId =
  | 'B2B_MISSING_GSTIN'
  | 'INVALID_GSTIN_FORMAT'
  | 'MISSING_PLACE_OF_SUPPLY'
  | 'MISSING_HSN_SAC'
  | 'INTERSTATE_SPLIT_MISMATCH'
  | 'COMPOSITION_CHARGING_GST'
  | 'ZERO_TAX_ON_TAXABLE'

export interface GstCheckDocRef {
  id: string
  documentNumber: string
}

export interface GstCheck {
  id: GstCheckId
  severity: GstCheckSeverity
  count: number
  documents: GstCheckDocRef[]
}

export interface GstFilingReadiness {
  period: string
  returnType: 'GSTR1' | 'GSTR3B'
  documentsScanned: number
  checks: GstCheck[]
  blockerCount: number
  warningCount: number
  readyToFile: boolean
}
