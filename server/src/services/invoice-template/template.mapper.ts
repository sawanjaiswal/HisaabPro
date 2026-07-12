/**
 * Invoice Template — pure DB-row → API-DTO mappers.
 *
 * `isDefault` is DERIVED (defaultForTypes.length > 0) — never a stored column
 * (R8). `defaultForTypes` comes from the joined TemplateDefault rows.
 */

import type { DocumentType } from '../../../../shared/enums.js'
import type {
  InvoiceTemplateDTO,
  TemplateSummary,
  TemplateConfig,
  PrintSettings,
} from './template.types.js'

/** Minimal shape the mappers need from a template row + its default rows. */
export interface TemplateRow {
  id: string
  businessId: string
  name: string
  baseTemplate: string
  config: unknown
  printSettings: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  defaultFor: Array<{ documentType: string }>
}

/** Row (no config selected) → list summary. */
export interface TemplateSummaryRow {
  id: string
  name: string
  baseTemplate: string
  isActive: boolean
  updatedAt: Date
  defaultFor: Array<{ documentType: string }>
}

function toDefaultForTypes(rows: Array<{ documentType: string }>): DocumentType[] {
  return rows.map((r) => r.documentType as DocumentType)
}

export function toTemplateSummary(row: TemplateSummaryRow): TemplateSummary {
  const defaultForTypes = toDefaultForTypes(row.defaultFor)
  return {
    id: row.id,
    name: row.name,
    baseTemplate: row.baseTemplate,
    isDefault: defaultForTypes.length > 0,
    defaultForTypes,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toInvoiceTemplate(row: TemplateRow): InvoiceTemplateDTO {
  const defaultForTypes = toDefaultForTypes(row.defaultFor)
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    baseTemplate: row.baseTemplate,
    isDefault: defaultForTypes.length > 0,
    defaultForTypes,
    isActive: row.isActive,
    config: (row.config ?? {}) as TemplateConfig,
    printSettings: (row.printSettings ?? {}) as PrintSettings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  }
}
