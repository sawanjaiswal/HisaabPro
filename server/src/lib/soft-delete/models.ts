/**
 * Soft-delete model registry — SSOT for which models use soft delete.
 * The middleware, cascade service, recycle bin, and enforcement scripts
 * all read from this single list.
 */

/** Models that participate in soft delete (isDeleted + deletedAt) */
export const SOFT_DELETE_MODELS = [
  // Core business entities
  'Party',
  'PartyAddress',
  'PartyGroup',
  'PartyPricing',
  'OpeningBalance',
  'Product',
  'Category',
  'Unit',
  'UnitConversion',
  'CustomFieldDefinition',

  // Documents & invoicing
  'Document',
  'DocumentNumberSeries',
  'TermsAndConditionsTemplate',

  // Payments & finance
  'Payment',
  'Expense',
  'OtherIncome',
  'Cheque',
  'BankAccount',
  'LedgerAccount',
  'LoanAccount',
  'ExpenseCategory',
  'TaxCategory',
  'RecurringInvoice',

  // Roles & staff
  'Role',
  'StaffInvite',

  // Inventory
  'Batch',
  'Godown',
  'SerialNumber',
] as const

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number]

/** Models that should NEVER be soft-deleted (immutable audit/transaction logs) */
export const IMMUTABLE_MODELS = [
  'AuditLog',
  'AdminAction',
  'StockMovement',
  'JournalEntry',
  'JournalEntryLine',
  'GodownTransfer',
  'LoanTransaction',
  'DocumentShareLog',
  'ReferralEvent',
] as const
