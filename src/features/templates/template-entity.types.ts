/** Invoice Templates — Entity, settings, form data, and API response interfaces
 *
 * Part of the template types split. Re-exported from template.types.ts.
 */

import type { DocumentType } from '../invoices/invoice.types'
import type { BaseTemplate, PageMargins, PageOrientation, PageSize, RoundOffMethod, RoundOffPrecision } from './template-layout.types'
import type { TemplateConfig } from './template-config.types'

// ─── Print settings ───────────────────────────────────────────────────────────

/**
 * Print / PDF render settings.
 * Stored per template so thermal and A4 templates never bleed settings into each other.
 */
export interface PrintSettings {
  pageSize: PageSize
  orientation: PageOrientation
  margins: PageMargins
  /** Number of copies sent to the printer (1-5) */
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
  /** User-assigned name, e.g. "Classic A4 - English" */
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
  /** 0-3 decimal places for quantity inputs */
  quantity: number
  /** 0-3 decimal places for rate inputs */
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
