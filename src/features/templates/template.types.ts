/** Invoice Templates — Type definitions
 *
 * Covers all template customization, print settings, and invoice-level
 * round-off / decimal precision settings.
 *
 * PRD: invoice-templates-PLAN.md
 * Depends on: invoice.types.ts (DocumentType)
 */

import type { DocumentType } from '../invoices/invoice.types'

// ─── Base template ────────────────────────────────────────────────────────────

/** The 6 factory-shipped base templates. User-created templates derive from one. */
export type BaseTemplate =
  | 'THERMAL_58MM'
  | 'THERMAL_80MM'
  | 'A4_CLASSIC'
  | 'A4_MODERN'
  | 'A5_COMPACT'
  | 'A4_DETAILED'

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
 * '1'    → nearest ₹1 (most common for retail)
 * '0.50' → nearest ₹0.50
 * '0.10' → nearest ₹0.10
 * 'none' → no rounding applied
 */
export type RoundOffPrecision = '1' | '0.50' | '0.10' | 'none'

// ─── Customisation tab ────────────────────────────────────────────────────────

/** Tabs shown in the template editor sidebar */
export type CustomizationTab = 'layout' | 'columns' | 'fields' | 'style' | 'text' | 'print'

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
  /** Max logo height in points (PDF units). Typical range: 40–100 */
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

// ─── Print settings ───────────────────────────────────────────────────────────

/**
 * Print / PDF render settings.
 * Stored per template so thermal and A4 templates never bleed settings into each other.
 */
export interface PrintSettings {
  pageSize: PageSize
  orientation: PageOrientation
  margins: PageMargins
  /** Number of copies sent to the printer (1–5) */
  copies: number
  /** Repeat the invoice header on every page when the document spans multiple pages */
  headerOnAllPages: boolean
  /** Print page numbers in the footer */
  pageNumbers: boolean
  /** Maximum line items per page before a page break is inserted (0 = auto) */
  itemsPerPage: number
}

// ─── Invoice template entity ──────────────────────────────────────────────────

/**
 * Full Invoice Template entity returned by the API.
 * One business can have multiple templates; exactly one is the default.
 */
export interface InvoiceTemplate {
  id: string
  businessId: string
  /** User-assigned name, e.g. "Classic A4 – English" */
  name: string
  baseTemplate: BaseTemplate
  config: TemplateConfig
  printSettings: PrintSettings
  isActive: boolean
  /** If true, this template is used when no explicit template is chosen */
  isDefault: boolean
  /** Document types for which this template is the default, e.g. ['SALE_INVOICE'] */
  defaultForTypes: DocumentType[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Lightweight summary used in the template list view */
export interface TemplateSummary {
  id: string
  name: string
  baseTemplate: BaseTemplate
  isDefault: boolean
  defaultForTypes: DocumentType[]
  isActive: boolean
  updatedAt: string
}

// ─── Invoice-level settings ───────────────────────────────────────────────────

/** Round-off settings that apply to the grand total of every invoice */
export interface RoundOffSettings {
  enabled: boolean
  precision: RoundOffPrecision
  /** If true, the round-off row is shown as a line in the totals block */
  showOnInvoice: boolean
  method: RoundOffMethod
}

/**
 * Number of decimal places shown for each quantity/rate/amount field.
 * `amount` is always 2 (paise representation) — not user-configurable.
 */
export interface DecimalPrecisionSettings {
  /** 0–3 decimal places for quantity inputs */
  quantity: number
  /** 0–3 decimal places for rate inputs */
  rate: number
  /** Always 2 — present for completeness but not shown in settings UI */
  amount: number
}

/** Business-level invoice settings (round-off + decimal precision) */
export interface InvoiceSettings {
  roundOff: RoundOffSettings
  decimalPrecision: DecimalPrecisionSettings
}

// ─── Form data ────────────────────────────────────────────────────────────────

/** Payload for creating or updating a template */
export interface TemplateFormData {
  name: string
  baseTemplate: BaseTemplate
  config: TemplateConfig
  printSettings: PrintSettings
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface TemplateListResponse {
  templates: TemplateSummary[]
}

export interface TemplateDetailResponse {
  template: InvoiceTemplate
}
