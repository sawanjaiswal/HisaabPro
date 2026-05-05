/**
 * GST Phase 2 — Type definitions
 *
 * All monetary rates in BASIS POINTS (100 = 1%, 1800 = 18%).
 * These match the server's GstSettingsResponse shape exactly.
 */

export type TaxPricingMode = 'EXCLUSIVE' | 'INCLUSIVE'

export type TurnoverSlab =
  | 'BELOW_40L'
  | '40L_TO_1CR'
  | '1CR_TO_5CR'
  | 'ABOVE_5CR'

/** Composition rates allowed by GST Composition Scheme (basis points) */
export type CompositionRate = 100 | 500 | 600

export interface GstSettings {
  /** GSTIN (15-char uppercase) or null if not set */
  gstin: string | null
  /** 2-digit state code derived from GSTIN */
  stateCode: string | null
  /** Master gate — when false, no GST is applied to any document */
  gstEnabled: boolean
  /** Whether tax is included in prices (INCLUSIVE) or added on top (EXCLUSIVE) */
  taxPricingMode: TaxPricingMode
  /** Whether the business is under the Composition Scheme */
  compositionScheme: boolean
  /** Composition tax rate in basis points (100=1%, 500=5%, 600=6%) */
  compositionRate: CompositionRate | null
  /** E-Invoice (IRN generation) — Phase 3 */
  eInvoiceEnabled: boolean
  /** E-Way Bill generation — Phase 3 */
  eWayBillEnabled: boolean
  /** Optional declaration printed on invoices */
  gstDeclarationText: string | null
  /** Turnover bracket for compliance categorisation */
  turnoverSlab: TurnoverSlab | null
}

/** Fields accepted by PATCH /api/gst/settings */
export type PatchGstSettingsInput = Partial<
  Pick<
    GstSettings,
    | 'gstin'
    | 'gstEnabled'
    | 'taxPricingMode'
    | 'compositionScheme'
    | 'compositionRate'
    | 'eInvoiceEnabled'
    | 'eWayBillEnabled'
    | 'gstDeclarationText'
    | 'turnoverSlab'
  >
>
