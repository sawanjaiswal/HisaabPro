/** Invoice Templates — Constants and configuration
 *
 * All label maps, defaults, and config values for the template system.
 * No business logic here — pure data.
 *
 * PRD: invoice-templates-PLAN.md
 */

import type { DocumentType } from '../invoices/invoice.types'
import type {
  BaseTemplate,
  CustomizationTab,
  DecimalPrecisionSettings,
  HeaderStyle,
  InvoiceSettings,
  ItemTableStyle,
  LogoPosition,
  PageMargins,
  PageOrientation,
  PageSize,
  PrintSettings,
  RoundOffMethod,
  RoundOffPrecision,
  RoundOffSettings,
  SummaryPosition,
  TemplateFontFamily,
  TemplateFontSize,
  TemplateColorsConfig,
  TemplateColumnsConfig,
  TemplateConfig,
  TemplateFieldsConfig,
  TemplateLayoutConfig,
  TemplateTypographyConfig,
} from './template.types'

// ─── Base template labels ─────────────────────────────────────────────────────

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

// ─── Layout option labels ─────────────────────────────────────────────────────

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

// ─── Typography labels ────────────────────────────────────────────────────────

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

// ─── Print / page labels ──────────────────────────────────────────────────────

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

// ─── Round-off labels ─────────────────────────────────────────────────────────

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

// ─── Customisation tab labels ─────────────────────────────────────────────────

export const CUSTOMIZATION_TAB_LABELS: Record<CustomizationTab, string> = {
  layout:  'Layout',
  columns: 'Columns',
  fields:  'Fields',
  style:   'Style',
  text:    'Text',
  print:   'Print',
}

// ─── Accent colour presets ────────────────────────────────────────────────────

/** Quick-select accent colours shown in the Style tab colour picker */
export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: 'Blue',   hex: '#2563EB' },
  { name: 'Green',  hex: '#059669' },
  { name: 'Red',    hex: '#DC2626' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Black',  hex: '#111827' },
]

// ─── Document type title / label maps ─────────────────────────────────────────
// Source: PRD §6 — label mapping table

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

// ─── Field length limits ──────────────────────────────────────────────────────

export const MAX_TEMPLATE_NAME_LENGTH = 100
export const MAX_HEADER_TEXT_LENGTH   = 200
export const MAX_FOOTER_TEXT_LENGTH   = 500
export const MAX_TERMS_TEXT_LENGTH    = 2000
export const MAX_COPIES               = 5

// ─── Default configs ──────────────────────────────────────────────────────────

const DEFAULT_LAYOUT_CONFIG: TemplateLayoutConfig = {
  logoPosition:      'left',
  logoMaxHeight:     60,
  headerStyle:       'side-by-side',
  itemTableStyle:    'bordered',
  summaryPosition:   'right',
  signaturePosition: 'right',
}

const DEFAULT_COLUMNS_CONFIG: TemplateColumnsConfig = {
  serialNumber:   { visible: true,  label: '#' },
  itemName:       { visible: true,  label: 'Item' },
  hsn:            { visible: false, label: 'HSN/SAC' },
  quantity:       { visible: true,  label: 'Qty' },
  unit:           { visible: true,  label: 'Unit' },
  rate:           { visible: true,  label: 'Rate' },
  discount:       { visible: false, label: 'Discount %' },
  discountAmount: { visible: false, label: 'Discount' },
  taxRate:        { visible: false, label: 'Tax %' },
  taxAmount:      { visible: false, label: 'Tax' },
  cessRate:       { visible: false, label: 'Cess %' },
  cessAmount:     { visible: false, label: 'Cess' },
  amount:         { visible: true,  label: 'Amount' },
}

const DEFAULT_FIELDS_CONFIG: TemplateFieldsConfig = {
  // Business info
  businessGstin:      false,
  businessPan:        false,
  businessPhone:      true,
  businessEmail:      false,
  businessAddress:    true,
  // Customer info
  customerGstin:      false,
  customerPhone:      true,
  customerAddress:    true,
  shippingAddress:    false,
  placeOfSupply:      false,
  // Document metadata
  invoiceNumber:      true,
  invoiceDate:        true,
  dueDate:            true,
  poNumber:           false,
  vehicleNumber:      false,
  transportDetails:   false,
  // Footer blocks
  bankDetails:        false,
  signature:          false,
  termsAndConditions: true,
  notes:              true,
  totalInWords:       true,
  qrCode:             false,
  watermark:          false,
}

const DEFAULT_TYPOGRAPHY_CONFIG: TemplateTypographyConfig = {
  fontFamily:     'inter',
  fontSize:       'medium',
  headerFontSize: 'medium',
}

const DEFAULT_COLORS_CONFIG: TemplateColorsConfig = {
  accent:           '#2563EB',
  headerBg:         '#2563EB',
  headerText:       '#FFFFFF',
  tableBorderColor: '#E5E7EB',
  tableHeaderBg:    '#F3F4F6',
  tableHeaderText:  '#111827',
}

/**
 * Full default TemplateConfig.
 * Used when creating a new template or resetting a custom template to defaults.
 */
export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  layout:     DEFAULT_LAYOUT_CONFIG,
  columns:    DEFAULT_COLUMNS_CONFIG,
  fields:     DEFAULT_FIELDS_CONFIG,
  typography: DEFAULT_TYPOGRAPHY_CONFIG,
  colors:     DEFAULT_COLORS_CONFIG,
  headerText: '',
  footerText: 'Thank you for your business!',
  termsText:  '',
}

// ─── Default print settings per base template ─────────────────────────────────

/** Default PrintSettings for each base template. */
export const DEFAULT_PRINT_SETTINGS: Record<BaseTemplate, PrintSettings> = {
  THERMAL_58MM: {
    pageSize:         'THERMAL_58MM',
    orientation:      'portrait',
    margins:          'none',
    copies:           1,
    headerOnAllPages: false,
    pageNumbers:      false,
    itemsPerPage:     0,
  },
  THERMAL_80MM: {
    pageSize:         'THERMAL_80MM',
    orientation:      'portrait',
    margins:          'none',
    copies:           1,
    headerOnAllPages: false,
    pageNumbers:      false,
    itemsPerPage:     0,
  },
  A4_CLASSIC: {
    pageSize:         'A4',
    orientation:      'portrait',
    margins:          'normal',
    copies:           1,
    headerOnAllPages: true,
    pageNumbers:      true,
    itemsPerPage:     20,
  },
  A4_MODERN: {
    pageSize:         'A4',
    orientation:      'portrait',
    margins:          'normal',
    copies:           1,
    headerOnAllPages: true,
    pageNumbers:      true,
    itemsPerPage:     20,
  },
  A5_COMPACT: {
    pageSize:         'A5',
    orientation:      'portrait',
    margins:          'narrow',
    copies:           1,
    headerOnAllPages: false,
    pageNumbers:      false,
    itemsPerPage:     15,
  },
  A4_DETAILED: {
    pageSize:         'A4',
    orientation:      'portrait',
    margins:          'normal',
    copies:           1,
    headerOnAllPages: true,
    pageNumbers:      true,
    itemsPerPage:     15,
  },
}

// ─── Default invoice settings ─────────────────────────────────────────────────

const DEFAULT_ROUND_OFF_SETTINGS: RoundOffSettings = {
  enabled:       false,
  precision:     '1',
  showOnInvoice: true,
  method:        'round',
}

const DEFAULT_DECIMAL_PRECISION_SETTINGS: DecimalPrecisionSettings = {
  quantity: 2,
  rate:     2,
  amount:   2,
}

/**
 * Default business-level InvoiceSettings.
 * Applied when a business has not yet configured round-off or decimal precision.
 */
export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  roundOff:         DEFAULT_ROUND_OFF_SETTINGS,
  decimalPrecision: DEFAULT_DECIMAL_PRECISION_SETTINGS,
}

// ─── Column order ─────────────────────────────────────────────────────────────

/** Stable print order for all line-item table columns.
 *  Used by getVisibleColumns / countVisibleColumns in template.utils.ts. */
export const COLUMN_ORDER: Array<keyof TemplateColumnsConfig> = [
  'serialNumber',
  'itemName',
  'hsn',
  'quantity',
  'unit',
  'rate',
  'discount',
  'discountAmount',
  'taxRate',
  'taxAmount',
  'cessRate',
  'cessAmount',
  'amount',
]

// ─── Legacy aliases (kept for backwards compatibility with template.utils.ts) ─

/** @deprecated Use MAX_TEMPLATE_NAME_LENGTH */
export const TEMPLATE_NAME_MAX = MAX_TEMPLATE_NAME_LENGTH
