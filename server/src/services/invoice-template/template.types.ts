/**
 * Invoice Template — server DTO types (wire shapes).
 *
 * These mirror the FE canon in `src/features/templates/template-entity.types.ts`
 * and the contract in `docs/API_CONTRACTS_invoice-templates.md`. Do not diverge.
 */

import type { DocumentType } from '../../../../shared/enums.js'

/** Opaque JSON blobs — never per-key validated by the server (R3). */
export type TemplateConfig = Record<string, unknown>
export type PrintSettings = Record<string, unknown>

/** List item — NO config / printSettings (excluded for list perf). */
export interface TemplateSummary {
  id: string
  name: string
  baseTemplate: string
  isDefault: boolean // derived = defaultForTypes.length > 0
  defaultForTypes: DocumentType[]
  isActive: boolean
  updatedAt: string // ISO
}

/** Full entity — summary + config + printSettings + timestamps. */
export interface InvoiceTemplateDTO extends TemplateSummary {
  businessId: string
  config: TemplateConfig
  printSettings: PrintSettings
  createdAt: string // ISO
  deletedAt: string | null
}

/** set-default response shape. */
export interface SetDefaultResult {
  id: string
  defaultForTypes: DocumentType[]
}

// ─── Invoice settings (wire) ──────────────────────────────────────────────────

export type RoundOffPrecisionWire = '1' | '0.50' | '0.10' | 'none'
export type RoundOffMethodWire = 'round' | 'floor' | 'ceil'

export interface InvoiceSettingsDTO {
  roundOff: {
    enabled: boolean
    precision: RoundOffPrecisionWire
    showOnInvoice: boolean
    method: RoundOffMethodWire
  }
  decimalPrecision: {
    quantity: number // 0..3
    rate: number // 0..3
    amount: 2 // fixed; echoed
  }
}
