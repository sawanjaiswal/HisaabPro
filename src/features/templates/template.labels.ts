/** Invoice Templates — Layout, typography, and document type label maps
 *
 * Base template labels are in template.base-labels.ts.
 * No business logic, no defaults — pure label lookups.
 *
 * PRD: invoice-templates-PLAN.md
 */

import type { DocumentType } from '../invoices/invoice.types'
import type {
  CopyLabelMode,
  CustomizationTab,
  HeaderStyle,
  ItemTableStyle,
  LogoPosition,
  PageMargins,
  PageOrientation,
  PageSize,
  RoundOffMethod,
  RoundOffPrecision,
  StampStyle,
  SummaryPosition,
  TemplateFontFamily,
  TemplateFontSize,
  TemplateLineHeight,
} from './template.types'

// Re-export base template labels for barrel consumers
export {
  BASE_TEMPLATE_LABELS,
  BASE_TEMPLATE_DESCRIPTIONS,
  BASE_TEMPLATE_PAGE_SIZE,
} from './template.base-labels'

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
  xs:     'XS',
  small:  'Small',
  medium: 'Medium',
  large:  'Large',
  xl:     'XL',
}

export const LINE_HEIGHT_LABELS: Record<TemplateLineHeight, string> = {
  compact:  'Compact',
  normal:   'Normal',
  relaxed:  'Relaxed',
}

// --- Stamp & copy label labels -----------------------------------------------

export const STAMP_STYLE_LABELS: Record<StampStyle, string> = {
  badge:     'Badge',
  watermark: 'Watermark',
  none:      'None',
}

export const COPY_LABEL_MODE_LABELS: Record<CopyLabelMode, string> = {
  auto:   'Auto',
  manual: 'Manual',
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
  CREDIT_NOTE:      'Credit Note',
  DEBIT_NOTE:       'Debit Note',
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
  CREDIT_NOTE:      'Credit Note No.',
  DEBIT_NOTE:       'Debit Note No.',
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
  CREDIT_NOTE:      'Credit Note Date',
  DEBIT_NOTE:       'Debit Note Date',
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
  CREDIT_NOTE:      'Credit To',
  DEBIT_NOTE:       'Debit To',
}
