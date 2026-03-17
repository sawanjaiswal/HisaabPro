/** Invoice Templates — Config sub-object interfaces
 *
 * Part of the template types split. Re-exported from template.types.ts.
 */

import type {
  HeaderStyle,
  ItemTableStyle,
  LogoPosition,
  SignaturePosition,
  SummaryPosition,
  TemplateFontFamily,
  TemplateFontSize,
} from './template-layout.types'

// ─── Config sub-objects ───────────────────────────────────────────────────────

/** Visibility + display label for a single line-item table column */
export interface ColumnConfig {
  /** Whether the column appears on the printed invoice */
  visible: boolean
  /** Overrideable column header label, e.g. "Qty" or "Quantity" */
  label: string
}

/** Layout section of TemplateConfig */
export interface TemplateLayoutConfig {
  logoPosition: LogoPosition
  /** Max logo height in points (PDF units). Typical range: 40-100 */
  logoMaxHeight: number
  headerStyle: HeaderStyle
  itemTableStyle: ItemTableStyle
  summaryPosition: SummaryPosition
  signaturePosition: SignaturePosition
}

/**
 * Controls which columns appear in the line-items table and their labels.
 * Each field maps to a ColumnConfig { visible, label }.
 */
export interface TemplateColumnsConfig {
  serialNumber: ColumnConfig
  itemName: ColumnConfig
  hsn: ColumnConfig
  quantity: ColumnConfig
  unit: ColumnConfig
  rate: ColumnConfig
  discount: ColumnConfig
  discountAmount: ColumnConfig
  taxRate: ColumnConfig
  taxAmount: ColumnConfig
  cessRate: ColumnConfig
  cessAmount: ColumnConfig
  amount: ColumnConfig
}

/**
 * Boolean flags controlling which data blocks appear on the printed invoice.
 * Hiding a block removes it entirely — no blank lines or empty placeholders.
 */
export interface TemplateFieldsConfig {
  // Business info
  businessGstin: boolean
  businessPan: boolean
  businessPhone: boolean
  businessEmail: boolean
  businessAddress: boolean
  // Customer info
  customerGstin: boolean
  customerPhone: boolean
  customerAddress: boolean
  shippingAddress: boolean
  placeOfSupply: boolean
  // Document metadata
  invoiceNumber: boolean
  invoiceDate: boolean
  dueDate: boolean
  poNumber: boolean
  vehicleNumber: boolean
  transportDetails: boolean
  // Footer blocks
  bankDetails: boolean
  signature: boolean
  termsAndConditions: boolean
  notes: boolean
  totalInWords: boolean
  qrCode: boolean
  watermark: boolean
}

/** Typography section of TemplateConfig */
export interface TemplateTypographyConfig {
  fontFamily: TemplateFontFamily
  fontSize: TemplateFontSize
  headerFontSize: TemplateFontSize
}

/**
 * Color overrides for the template.
 * All values must be valid hex strings (e.g. "#2563EB").
 * These map to CSS variables at render time — never hard-coded inline.
 */
export interface TemplateColorsConfig {
  /** Primary accent used for header bar, table header, and borders */
  accent: string
  /** Background color of the invoice header section */
  headerBg: string
  /** Text color of the invoice header section */
  headerText: string
  /** Border color for table cells (bordered / striped styles) */
  tableBorderColor: string
  /** Background color of the table column-header row */
  tableHeaderBg: string
  /** Text color of the table column-header row */
  tableHeaderText: string
}

/**
 * Complete template configuration stored as a JSON blob in InvoiceTemplate.
 * Covers layout, column visibility, field visibility, typography, colors, and text.
 */
export interface TemplateConfig {
  layout: TemplateLayoutConfig
  columns: TemplateColumnsConfig
  fields: TemplateFieldsConfig
  typography: TemplateTypographyConfig
  colors: TemplateColorsConfig
  /** Custom text printed above the document title, e.g. "|| Shree Ganeshay Namah ||" */
  headerText: string
  /** Custom text printed at the very bottom, e.g. "Thank you for your business!" */
  footerText: string
  /** Default T&C text pre-filled on new invoices using this template */
  termsText: string
}
