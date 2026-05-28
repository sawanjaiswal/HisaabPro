/**
 * Types for the GST filing-readiness validator (#144).
 * Deterministic rules engine over a period's sale/note documents — surfaces
 * blockers and warnings BEFORE the user exports GSTR-1 / GSTR-3B.
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

/** One offending document, surfaced so the FE can deep-link to it. */
export interface GstCheckDocRef {
  id: string
  documentNumber: string
}

/** Result of one rule over the scanned documents. */
export interface GstCheck {
  id: GstCheckId
  severity: GstCheckSeverity
  /** Number of documents that tripped this rule. */
  count: number
  /** Up to GST_CHECK_DOC_CAP offending docs (capped to keep the payload small). */
  documents: GstCheckDocRef[]
}

export interface GstFilingReadiness {
  period: string
  returnType: 'GSTR1' | 'GSTR3B'
  documentsScanned: number
  checks: GstCheck[]
  blockerCount: number
  warningCount: number
  /** True when no blocker-severity check fired. */
  readyToFile: boolean
}

/** Normalized line item used by the pure rules (subset of DocumentLineItem). */
export interface CheckLine {
  hsnCode: string | null
  sacCode: string | null
  taxableValue: number
  cgstRate: number
  sgstRate: number
  igstRate: number
}

/** Normalized document used by the pure rules (subset of Document + party). */
export interface CheckDoc {
  id: string
  documentNumber: string
  supplyType: string
  placeOfSupply: string | null
  totalCgst: number
  totalSgst: number
  totalIgst: number
  partyGstin: string | null
  lines: CheckLine[]
}

/** Business-level context the rules need (state, composition flag). */
export interface CheckContext {
  businessStateCode: string | null
  businessComposition: boolean
}
