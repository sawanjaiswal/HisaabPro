/** Invoice Templates — Constants barrel
 *
 * Re-exports from template.labels.ts and template.defaults.ts,
 * plus field-length limits, colour presets, and legacy aliases.
 *
 * Existing imports of `template.constants` continue to work unchanged.
 *
 * PRD: invoice-templates-PLAN.md
 */

// Re-export all labels
export {
  BASE_TEMPLATE_LABELS,
  BASE_TEMPLATE_DESCRIPTIONS,
  BASE_TEMPLATE_PAGE_SIZE,
  LOGO_POSITION_LABELS,
  HEADER_STYLE_LABELS,
  TABLE_STYLE_LABELS,
  SUMMARY_POSITION_LABELS,
  FONT_FAMILY_LABELS,
  FONT_SIZE_LABELS,
  LINE_HEIGHT_LABELS,
  STAMP_STYLE_LABELS,
  COPY_LABEL_MODE_LABELS,
  PAGE_SIZE_LABELS,
  ORIENTATION_LABELS,
  MARGINS_LABELS,
  ROUND_OFF_PRECISION_LABELS,
  ROUND_OFF_METHOD_LABELS,
  CUSTOMIZATION_TAB_LABELS,
  DOCUMENT_TYPE_TITLE_LABELS,
  DOCUMENT_TYPE_NUMBER_LABELS,
  DOCUMENT_TYPE_DATE_LABELS,
  DOCUMENT_TYPE_PARTY_LABELS,
} from './template.labels'

// Re-export all defaults
export {
  DEFAULT_TEMPLATE_CONFIG,
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_INVOICE_SETTINGS,
  COLUMN_ORDER,
} from './template.defaults'

// --- Field length limits -----------------------------------------------------

export const MAX_TEMPLATE_NAME_LENGTH = 100
export const MAX_HEADER_TEXT_LENGTH   = 200
export const MAX_FOOTER_TEXT_LENGTH   = 500
export const MAX_TERMS_TEXT_LENGTH    = 2000
export const MAX_COPIES               = 5

// --- Accent colour presets ---------------------------------------------------

/** Quick-select accent colours shown in the Style tab colour picker */
export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: 'Blue',   hex: '#2563EB' },
  { name: 'Green',  hex: '#059669' },
  { name: 'Red',    hex: '#DC2626' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Black',  hex: '#111827' },
]

// --- Legacy aliases (kept for backwards compatibility with template.utils.ts) -

/** @deprecated Use MAX_TEMPLATE_NAME_LENGTH */
export const TEMPLATE_NAME_MAX = MAX_TEMPLATE_NAME_LENGTH

// ─── GST Phase 2 — Declaration text defaults ─────────────────────────────────

/**
 * Default declaration for regular GST-registered dealers.
 * Rendered when compositionScheme is false and no custom declaration text is set.
 */
export const STANDARD_GST_DECLARATION =
  'We hereby declare that this invoice shows the actual price of the goods described ' +
  'and that all particulars are true and correct. This is a computer generated invoice ' +
  'and does not require a physical signature.'

/**
 * Declaration for composition scheme dealers (Section 10, CGST Act, 2017).
 * Printed on Bill of Supply instead of a regular tax invoice.
 */
export const COMPOSITION_GST_DECLARATION =
  'I/We hereby declare that this Bill of Supply is being issued by a taxpayer registered ' +
  'under the Composition Levy (Section 10 of the CGST Act, 2017). Tax is not applicable ' +
  'on goods/services covered under composition scheme.'

/**
 * Appended to the declaration when the invoice is subject to Reverse Charge Mechanism (RCM).
 */
export const RCM_DECLARATION_APPENDIX =
  'Reverse Charge Applicable: The recipient of this supply is liable to pay tax under ' +
  'Reverse Charge Mechanism (RCM) as applicable under the GST Act.'

// ─── GST Phase 2 — QR code sizing ────────────────────────────────────────────

import type { PageSize } from './template-layout.types'

/** IRN QR code sizes in millimetres per paper size. 0 = hidden (too narrow). */
export const IRN_QR_SIZE_MM: Record<PageSize, number> = {
  A4:           40,
  A5:           35,
  THERMAL_80MM: 30,
  THERMAL_58MM:  0,
  LETTER:       40,
}

/** UPI QR code sizes in millimetres per paper size (fallback for non-GST docs). 0 = hidden. */
export const UPI_QR_SIZE_MM: Record<PageSize, number> = {
  A4:           35,
  A5:           30,
  THERMAL_80MM: 25,
  THERMAL_58MM:  0,
  LETTER:       35,
}
