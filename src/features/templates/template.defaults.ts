/** Invoice Templates — Default configurations
 *
 * All default config objects for templates, print settings, and invoice settings.
 * No labels here — those live in template.labels.ts.
 *
 * PRD: invoice-templates-PLAN.md
 */

import type {
  DecimalPrecisionSettings,
  InvoiceSettings,
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

// --- Default print settings (extracted to template.print-defaults.ts) --------
export { DEFAULT_PRINT_SETTINGS } from './template.print-defaults'

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
