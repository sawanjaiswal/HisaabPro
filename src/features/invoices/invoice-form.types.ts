/** Invoice Form — Types & Interfaces
 *
 * Shared types for the invoice form hook and its consumers.
 * Extracted from useInvoiceForm.ts for file-size compliance.
 */

import type { StockValidationItem } from './invoice.service'
import type { InvoiceTotals } from './invoice-calc.utils'
import type {
  DocumentType,
  DocumentFormData,
  LineItemFormData,
  AdditionalChargeFormData,
  PaymentTerms,
  RoundOffSetting,
} from './invoice.types'

// ─── Section tabs ─────────────────────────────────────────────────────────────

export type FormSection = 'items' | 'details' | 'charges'

// ─── Hook options ─────────────────────────────────────────────────────────────

export interface UseInvoiceFormOptions {
  /** When set, form operates in edit mode — calls updateDocument instead of createDocument */
  editId?: string
  /** Pre-fill form with existing invoice data (edit mode) */
  initialData?: DocumentFormData
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseInvoiceFormReturn {
  form: DocumentFormData
  errors: Record<string, string>
  isSubmitting: boolean
  isEditMode: boolean
  activeSection: FormSection
  setActiveSection: (section: FormSection) => void
  updateField: <K extends keyof DocumentFormData>(
    key: K,
    value: DocumentFormData[K],
  ) => void
  addLineItem: (item: LineItemFormData) => void
  updateLineItem: (index: number, item: Partial<LineItemFormData>) => void
  removeLineItem: (index: number) => void
  addCharge: (charge: AdditionalChargeFormData) => void
  updateCharge: (index: number, charge: Partial<AdditionalChargeFormData>) => void
  removeCharge: (index: number) => void
  totals: InvoiceTotals
  stockWarnings: StockValidationItem[]
  hasStockBlocks: boolean
  validate: () => boolean
  handleSubmit: () => Promise<void>
  handleSaveDraft: () => Promise<void>
  reset: () => void
}

// Re-export types needed by sub-components
export type { PaymentTerms, DocumentType, RoundOffSetting }
