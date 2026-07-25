/** Invoicing & Documents — settings & terms-template types
 *
 * Business-level document configuration (GET /settings/documents) and the
 * Terms & Conditions template shapes. Split out of invoice-api.types.ts to
 * keep each file within the 250-line discipline; re-exported from there so
 * existing imports keep resolving.
 */

import type {
  ChargeType,
  DocumentStockValidation,
  DocumentType,
  ExportFormat,
  PaymentTerms,
  RoundOffSetting,
  ShareChannel,
} from './invoice-enums.types'

// ─── Document Settings ────────────────────────────────────────────────────────

export interface DocumentDefaultAdditionalCharge {
  name: string
  type: ChargeType
  /** Default value; 0 means no default amount pre-filled */
  value: number
}

/** Business-level document configuration — mirrors GET /settings/documents response */
export interface DocumentSettings {
  defaultPaymentTerms: PaymentTerms
  stockValidation: DocumentStockValidation
  roundOffTo: RoundOffSetting
  decimalPlaces: {
    quantity: number
    rate: number
    amount: number
  }
  defaultTermsAndConditions: string | null
  autoShareOnSave: boolean
  autoShareChannel: ShareChannel
  autoShareFormat: ExportFormat
  /** Whether to show profit margin to billing staff */
  showProfitDuringBilling: boolean
  allowFutureDates: boolean
  /** Days before a saved document is locked for editing (0 = no lock) */
  transactionLockDays: number
  recycleBinRetentionDays: number
  defaultAdditionalCharges: DocumentDefaultAdditionalCharge[]
  /** Block sales where qty < product.moq — returns MOQ_VIOLATION error on backend */
  enforceMoq: boolean
  /** Show 40×40 product thumbnail in each invoice line item row */
  showLineItemImages: boolean
}

// ─── Terms & Conditions Template ─────────────────────────────────────────────

export interface TermsTemplate {
  id: string
  name: string
  content: string
  isDefault: boolean
  appliesTo: DocumentType[]
  createdAt: string
  updatedAt: string
}

export interface TermsTemplateFormData {
  name: string
  content: string
  isDefault?: boolean
  appliesTo: DocumentType[]
}
