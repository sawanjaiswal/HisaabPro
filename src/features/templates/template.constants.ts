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
