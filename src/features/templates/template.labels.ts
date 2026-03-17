/** Invoice Templates — Label maps
 *
 * All human-readable label/description maps for the template system.
 * No business logic, no defaults — pure label lookups.
 *
 * PRD: invoice-templates-PLAN.md
 */

import type { DocumentType } from '../invoices/invoice.types'
import type {
  BaseTemplate,
  CustomizationTab,
  HeaderStyle,
  ItemTableStyle,
  LogoPosition,
  PageMargins,
  PageOrientation,
  PageSize,
  RoundOffMethod,
  RoundOffPrecision,
  SummaryPosition,
  TemplateFontFamily,
  TemplateFontSize,
} from './template.types'

// --- Base template labels ----------------------------------------------------

export const BASE_TEMPLATE_LABELS: Record<BaseTemplate, string> = {
  THERMAL_58MM: '58mm Thermal',
  THERMAL_80MM: '80mm Thermal',
  A4_CLASSIC:   'A4 Classic',
  A4_MODERN:    'A4 Modern',
  A5_COMPACT:   'A5 Compact',
  A4_DETAILED:  'A4 Detailed',
}

export const BASE_TEMPLATE_DESCRIPTIONS: Record<BaseTemplate, string> = {
  THERMAL_58MM: 'For 58mm roll receipt printers — minimal, space-efficient layout',
  THERMAL_80MM: 'For 80mm roll receipt printers — slightly wider with more columns',
  A4_CLASSIC:   'Traditional single-column layout, works on any A4 printer',
  A4_MODERN:    'Clean two-column header with accent color and modern spacing',
  A5_COMPACT:   'Half-page A5 — ideal for short invoices and delivery notes',
  A4_DETAILED:  'Full-detail A4 with HSN, tax breakdown, bank details, and signature',
}

/** Default page size for each base template */
export const BASE_TEMPLATE_PAGE_SIZE: Record<BaseTemplate, PageSize> = {
  THERMAL_58MM: 'THERMAL_58MM',
  THERMAL_80MM: 'THERMAL_80MM',
  A4_CLASSIC:   'A4',
  A4_MODERN:    'A4',
  A5_COMPACT:   'A5',
  A4_DETAILED:  'A4',
}

// --- Layout option labels ----------------------------------------------------

export const LOGO_POSITION_LABELS: Record<LogoPosition, string> = {
  left:   'Left',
  center: 'Centre',
  right:  'Right',
  none:   'No Logo',
}

export const HEADER_STYLE_LABELS: Record<HeaderStyle, string> = {
  'stacked':      'Stacked',
  'side-by-side': 'Side by Side',
  'minimal':      'Minimal',
}

export const TABLE_STYLE_LABELS: Record<ItemTableStyle, string> = {
  bordered: 'Bordered',
  striped:  'Striped',
  minimal:  'Minimal',
}

export const SUMMARY_POSITION_LABELS: Record<SummaryPosition, string> = {
  right:        'Right',
  center:       'Centre',
  'full-width': 'Full Width',
}

// --- Typography labels -------------------------------------------------------

export const FONT_FAMILY_LABELS: Record<TemplateFontFamily, string> = {
  'inter':     'Inter',
  'noto-sans': 'Noto Sans',
  'roboto':    'Roboto',
  'poppins':   'Poppins',
}

export const FONT_SIZE_LABELS: Record<TemplateFontSize, string> = {
  small:  'Small',
  medium: 'Medium',
  large:  'Large',
}

// --- Print / page labels -----------------------------------------------------

export const PAGE_SIZE_LABELS: Record<PageSize, string> = {
  A4:           'A4',
  A5:           'A5',
  THERMAL_58MM: '58mm Thermal',
  THERMAL_80MM: '80mm Thermal',
  LETTER:       'Letter (US)',
}

export const ORIENTATION_LABELS: Record<PageOrientation, string> = {
  portrait:  'Portrait',
  landscape: 'Landscape',
}

export const MARGINS_LABELS: Record<PageMargins, string> = {
  normal: 'Normal',
  narrow: 'Narrow',
  wide:   'Wide',
  none:   'None (edge-to-edge)',
}

// --- Round-off labels --------------------------------------------------------

export const ROUND_OFF_PRECISION_LABELS: Record<RoundOffPrecision, string> = {
  '1':    'Nearest ₹1',
  '0.50': 'Nearest ₹0.50',
  '0.10': 'Nearest ₹0.10',
  'none': 'No Rounding',
}

export const ROUND_OFF_METHOD_LABELS: Record<RoundOffMethod, string> = {
  round: 'Round (nearest)',
  floor: 'Round Down',
  ceil:  'Round Up',
}

// --- Customisation tab labels ------------------------------------------------

export const CUSTOMIZATION_TAB_LABELS: Record<CustomizationTab, string> = {
  layout:  'Layout',
  columns: 'Columns',
  fields:  'Fields',
  style:   'Style',
  text:    'Text',
  print:   'Print',
}

// --- Document type title / label maps ----------------------------------------
// Source: PRD S6 -- label mapping table

/** The document title printed in large type at the top of the invoice */
export const DOCUMENT_TYPE_TITLE_LABELS: Record<DocumentType, string> = {
  SALE_INVOICE:     'Tax Invoice',
  PURCHASE_INVOICE: 'Purchase Invoice',
  ESTIMATE:         'Estimate',
  PROFORMA:         'Proforma Invoice',
  SALE_ORDER:       'Sale Order',
  PURCHASE_ORDER:   'Purchase Order',
  DELIVERY_CHALLAN: 'Delivery Challan',
}

/** Label for the document number field, e.g. "Invoice No." */
export const DOCUMENT_TYPE_NUMBER_LABELS: Record<DocumentType, string> = {
  SALE_INVOICE:     'Invoice No.',
  PURCHASE_INVOICE: 'Purchase No.',
  ESTIMATE:         'Estimate No.',
  PROFORMA:         'Proforma No.',
  SALE_ORDER:       'SO No.',
  PURCHASE_ORDER:   'PO No.',
  DELIVERY_CHALLAN: 'Challan No.',
}

/** Label for the document date field, e.g. "Invoice Date" */
export const DOCUMENT_TYPE_DATE_LABELS: Record<DocumentType, string> = {
  SALE_INVOICE:     'Invoice Date',
  PURCHASE_INVOICE: 'Purchase Date',
  ESTIMATE:         'Estimate Date',
  PROFORMA:         'Date',
  SALE_ORDER:       'SO Date',
  PURCHASE_ORDER:   'PO Date',
  DELIVERY_CHALLAN: 'Challan Date',
}

/** Label for the customer / party address block on the invoice */
export const DOCUMENT_TYPE_PARTY_LABELS: Record<DocumentType, string> = {
  SALE_INVOICE:     'Bill To',
  PURCHASE_INVOICE: 'Supplier',
  ESTIMATE:         'To',
  PROFORMA:         'To',
  SALE_ORDER:       'Order From',
  PURCHASE_ORDER:   'Order To',
  DELIVERY_CHALLAN: 'Deliver To',
}
