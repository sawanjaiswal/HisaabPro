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

// --- Base template labels ----------------------------------------------------

export const BASE_TEMPLATE_LABELS: Record<BaseTemplate, string> = {
  THERMAL_58MM:      '58mm Thermal',
  THERMAL_80MM:      '80mm Thermal',
  A4_CLASSIC:        'A4 Classic',
  A4_MODERN:         'A4 Modern',
  A5_COMPACT:        'A5 Compact',
  A4_DETAILED:       'A4 Detailed',
  // Modern collection
  A4_ELEGANT:        'Elegant',
  A4_MINIMAL:        'Minimal',
  A4_BOLD:           'Bold',
  A4_CORPORATE:      'Corporate',
  A4_PROFESSIONAL:   'Professional',
  A4_CREATIVE:       'Creative',
  // Indian business
  A4_GST_STANDARD:   'GST Standard',
  A4_GST_DETAILED:   'GST Detailed',
  A4_RETAIL:         'Retail',
  A4_WHOLESALE:      'Wholesale',
  A4_KIRANA:         'Kirana Store',
  A4_MANUFACTURING:  'Manufacturing',
  // Industry
  A4_SERVICES:       'Services',
  A4_FREELANCER:     'Freelancer',
  A4_MEDICAL:        'Medical / Pharma',
  A4_RESTAURANT:     'Restaurant',
  A4_TRANSPORT:      'Transport',
  A4_CONSTRUCTION:   'Construction',
  // Compact & special
  A5_RECEIPT:        'A5 Receipt',
  A5_PROFESSIONAL:   'A5 Professional',
  A4_LETTERHEAD:     'Letterhead',
  A4_TWO_COLUMN:     'Two Column',
  A4_COLORFUL:       'Colorful',
  A4_DARK:           'Dark',
}

export const BASE_TEMPLATE_DESCRIPTIONS: Record<BaseTemplate, string> = {
  THERMAL_58MM:      'For 58mm roll receipt printers — minimal, space-efficient layout',
  THERMAL_80MM:      'For 80mm roll receipt printers — slightly wider with more columns',
  A4_CLASSIC:        'Traditional single-column layout, works on any A4 printer',
  A4_MODERN:         'Clean two-column header with accent color and modern spacing',
  A5_COMPACT:        'Half-page A5 — ideal for short invoices and delivery notes',
  A4_DETAILED:       'Full-detail A4 with HSN, tax breakdown, bank details, and signature',
  // Modern collection
  A4_ELEGANT:        'Sophisticated serif headers with gold accent — premium feel',
  A4_MINIMAL:        'Maximum white space, minimal borders — clean and distraction-free',
  A4_BOLD:           'Large headers, strong colors, high-impact design',
  A4_CORPORATE:      'Formal business layout with company branding prominently placed',
  A4_PROFESSIONAL:   'Balanced layout with subtle accent — suits any business',
  A4_CREATIVE:       'Asymmetric layout with vibrant colors — for design-forward businesses',
  // Indian business
  A4_GST_STANDARD:   'GST-compliant with GSTIN, HSN, CGST/SGST columns visible',
  A4_GST_DETAILED:   'Full GST with HSN, cess, place of supply, e-invoice fields',
  A4_RETAIL:         'Quick retail billing — no tax columns, prominent totals',
  A4_WHOLESALE:      'Quantity-focused with discount columns for bulk orders',
  A4_KIRANA:         'Simple layout for grocery & general stores — Hindi-friendly',
  A4_MANUFACTURING:  'Detailed with HSN, transport, vehicle number, delivery challan fields',
  // Industry
  A4_SERVICES:       'Service invoices with hourly/project rates, no quantity columns',
  A4_FREELANCER:     'Personal branding focus, bank details, clean single-column',
  A4_MEDICAL:        'Pharmacy/clinic billing with batch, expiry columns',
  A4_RESTAURANT:     'Food bill format — table number, no HSN, rounded totals',
  A4_TRANSPORT:      'LR/CN format with vehicle, route, consignor/consignee details',
  A4_CONSTRUCTION:   'Work order format with measurements, contractor details',
  // Compact & special
  A5_RECEIPT:        'Compact receipt for counter billing — A5 half-page',
  A5_PROFESSIONAL:   'Professional A5 with logo, accent bar, all contact info',
  A4_LETTERHEAD:     'Full letterhead with company branding, address bar at top',
  A4_TWO_COLUMN:     'Split layout — business details left, invoice info right',
  A4_COLORFUL:       'Vibrant multi-color sections — stands out in any inbox',
  A4_DARK:           'Dark header with white body — modern and striking',
}

/** Default page size for each base template */
export const BASE_TEMPLATE_PAGE_SIZE: Record<BaseTemplate, PageSize> = {
  THERMAL_58MM:      'THERMAL_58MM',
  THERMAL_80MM:      'THERMAL_80MM',
  A4_CLASSIC:        'A4',
  A4_MODERN:         'A4',
  A5_COMPACT:        'A5',
  A4_DETAILED:       'A4',
  A4_ELEGANT:        'A4',
  A4_MINIMAL:        'A4',
  A4_BOLD:           'A4',
  A4_CORPORATE:      'A4',
  A4_PROFESSIONAL:   'A4',
  A4_CREATIVE:       'A4',
  A4_GST_STANDARD:   'A4',
  A4_GST_DETAILED:   'A4',
  A4_RETAIL:         'A4',
  A4_WHOLESALE:      'A4',
  A4_KIRANA:         'A4',
  A4_MANUFACTURING:  'A4',
  A4_SERVICES:       'A4',
  A4_FREELANCER:     'A4',
  A4_MEDICAL:        'A4',
  A4_RESTAURANT:     'A4',
  A4_TRANSPORT:      'A4',
  A4_CONSTRUCTION:   'A4',
  A5_RECEIPT:        'A5',
  A5_PROFESSIONAL:   'A5',
  A4_LETTERHEAD:     'A4',
  A4_TWO_COLUMN:     'A4',
  A4_COLORFUL:       'A4',
  A4_DARK:           'A4',
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
