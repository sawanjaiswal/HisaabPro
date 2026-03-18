/** Invoice Templates — Layout, typography, and page/print type aliases
 *
 * Part of the template types split. Re-exported from template.types.ts.
 */

// ─── Base template ────────────────────────────────────────────────────────────

/** Factory-shipped base templates. User-created templates derive from one. */
export type BaseTemplate =
  | 'THERMAL_58MM'
  | 'THERMAL_80MM'
  | 'A4_CLASSIC'
  | 'A4_MODERN'
  | 'A5_COMPACT'
  | 'A4_DETAILED'
  // Modern collection
  | 'A4_ELEGANT'
  | 'A4_MINIMAL'
  | 'A4_BOLD'
  | 'A4_CORPORATE'
  | 'A4_PROFESSIONAL'
  | 'A4_CREATIVE'
  // Indian business collection
  | 'A4_GST_STANDARD'
  | 'A4_GST_DETAILED'
  | 'A4_RETAIL'
  | 'A4_WHOLESALE'
  | 'A4_KIRANA'
  | 'A4_MANUFACTURING'
  // Industry templates
  | 'A4_SERVICES'
  | 'A4_FREELANCER'
  | 'A4_MEDICAL'
  | 'A4_RESTAURANT'
  | 'A4_TRANSPORT'
  | 'A4_CONSTRUCTION'
  // Compact & receipt
  | 'A5_RECEIPT'
  | 'A5_PROFESSIONAL'
  | 'A4_LETTERHEAD'
  | 'A4_TWO_COLUMN'
  | 'A4_COLORFUL'
  | 'A4_DARK'

// ─── Layout options ───────────────────────────────────────────────────────────

/** Where the business logo appears in the invoice header */
export type LogoPosition = 'left' | 'center' | 'right' | 'none'

/** Layout of business name / logo vs. document title */
export type HeaderStyle = 'stacked' | 'side-by-side' | 'minimal'

/** Visual style of the line-items table */
export type ItemTableStyle = 'bordered' | 'striped' | 'minimal'

/** Where the totals summary block is placed */
export type SummaryPosition = 'right' | 'center' | 'full-width'

/** Where the signature block appears */
export type SignaturePosition = 'left' | 'right' | 'center'

// ─── Typography ───────────────────────────────────────────────────────────────

/** Supported font families (all loaded via @fontsource in the PDF renderer) */
export type TemplateFontFamily = 'inter' | 'noto-sans' | 'roboto' | 'poppins'

/** Relative font size scale */
export type TemplateFontSize = 'small' | 'medium' | 'large'

// ─── Page / print ─────────────────────────────────────────────────────────────

/** Physical page size sent to the printer or PDF renderer */
export type PageSize = 'A4' | 'A5' | 'THERMAL_58MM' | 'THERMAL_80MM' | 'LETTER'

/** Page orientation (thermal templates are always portrait) */
export type PageOrientation = 'portrait' | 'landscape'

/** Margin preset — 'none' is used for thermal printing */
export type PageMargins = 'normal' | 'narrow' | 'wide' | 'none'

// ─── Round-off ────────────────────────────────────────────────────────────────

/** Math method applied when rounding the grand total */
export type RoundOffMethod = 'round' | 'floor' | 'ceil'

/**
 * The precision to round to.
 * '1'    → nearest Rs 1 (most common for retail)
 * '0.50' → nearest Rs 0.50
 * '0.10' → nearest Rs 0.10
 * 'none' → no rounding applied
 */
export type RoundOffPrecision = '1' | '0.50' | '0.10' | 'none'

// ─── Customisation tab ────────────────────────────────────────────────────────

/** Tabs shown in the template editor sidebar */
export type CustomizationTab = 'layout' | 'columns' | 'fields' | 'style' | 'text' | 'print'
