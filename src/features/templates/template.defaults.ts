/** Invoice Templates — Default configurations
 *
 * All default config objects for templates, print settings, and invoice settings.
 * No labels here — those live in template.labels.ts.
 *
 * PRD: invoice-templates-PLAN.md
 */

import type {
  BaseTemplate,
  DecimalPrecisionSettings,
  InvoiceSettings,
  PrintSettings,
  RoundOffSettings,
  TemplateColorsConfig,
  TemplateColumnsConfig,
  TemplateConfig,
  TemplateFieldsConfig,
  TemplateLayoutConfig,
  TemplateTypographyConfig,
} from './template.types'

// --- Default template config -------------------------------------------------

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
  // Status & compliance
  paymentStatusStamp: true,
  udyamNumber:        false,
  totalQuantity:      true,
  copyLabel:          false,
}

const DEFAULT_TYPOGRAPHY_CONFIG: TemplateTypographyConfig = {
  fontFamily:     'inter',
  fontSize:       'medium',
  headerFontSize: 'medium',
  lineHeight:     'normal',
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

// --- Default print settings per base template --------------------------------

/** Standard A4 print settings — reused by most templates */
const A4_STANDARD: PrintSettings = {
  pageSize:         'A4',
  orientation:      'portrait',
  margins:          'normal',
  copies:           1,
  headerOnAllPages: true,
  pageNumbers:      true,
  itemsPerPage:     20,
  stampStyle:       'badge',
  copyLabels:       false,
  copyLabelMode:    'auto',
  copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
}

/** A5 print settings — reused by compact templates */
const A5_STANDARD: PrintSettings = {
  pageSize:         'A5',
  orientation:      'portrait',
  margins:          'narrow',
  copies:           1,
  headerOnAllPages: false,
  pageNumbers:      false,
  itemsPerPage:     15,
  stampStyle:       'badge',
  copyLabels:       false,
  copyLabelMode:    'auto',
  copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
}

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
    stampStyle:       'none',
    copyLabels:       false,
    copyLabelMode:    'auto',
    copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
  },
  THERMAL_80MM: {
    pageSize:         'THERMAL_80MM',
    orientation:      'portrait',
    margins:          'none',
    copies:           1,
    headerOnAllPages: false,
    pageNumbers:      false,
    itemsPerPage:     0,
    stampStyle:       'none',
    copyLabels:       false,
    copyLabelMode:    'auto',
    copyLabelNames:   ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
  },
  A4_CLASSIC:        { ...A4_STANDARD },
  A4_MODERN:         { ...A4_STANDARD },
  A5_COMPACT:        { ...A5_STANDARD },
  A4_DETAILED:       { ...A4_STANDARD, itemsPerPage: 15 },
  // Modern collection
  A4_ELEGANT:        { ...A4_STANDARD },
  A4_MINIMAL:        { ...A4_STANDARD },
  A4_BOLD:           { ...A4_STANDARD },
  A4_CORPORATE:      { ...A4_STANDARD },
  A4_PROFESSIONAL:   { ...A4_STANDARD },
  A4_CREATIVE:       { ...A4_STANDARD },
  // Indian business
  A4_GST_STANDARD:   { ...A4_STANDARD },
  A4_GST_DETAILED:   { ...A4_STANDARD, itemsPerPage: 15 },
  A4_RETAIL:         { ...A4_STANDARD },
  A4_WHOLESALE:      { ...A4_STANDARD },
  A4_KIRANA:         { ...A4_STANDARD },
  A4_MANUFACTURING:  { ...A4_STANDARD, itemsPerPage: 15 },
  // Industry
  A4_SERVICES:       { ...A4_STANDARD },
  A4_FREELANCER:     { ...A4_STANDARD },
  A4_MEDICAL:        { ...A4_STANDARD, itemsPerPage: 15 },
  A4_RESTAURANT:     { ...A4_STANDARD },
  A4_TRANSPORT:      { ...A4_STANDARD },
  A4_CONSTRUCTION:   { ...A4_STANDARD },
  // Compact & special
  A5_RECEIPT:        { ...A5_STANDARD },
  A5_PROFESSIONAL:   { ...A5_STANDARD, pageNumbers: true },
  A4_LETTERHEAD:     { ...A4_STANDARD },
  A4_TWO_COLUMN:     { ...A4_STANDARD },
  A4_COLORFUL:       { ...A4_STANDARD },
  A4_DARK:           { ...A4_STANDARD },
}

// --- Default invoice settings ------------------------------------------------

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

// --- Column order ------------------------------------------------------------

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
