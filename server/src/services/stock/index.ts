/**
 * Stock service public API — re-exports from focused sub-modules.
 * Import from this barrel rather than individual files.
 */

export { adjustStock } from './core.js'
export type { AdjustStockParams } from './core.js'

export {
  deductForSaleInvoice,
  addForPurchaseInvoice,
  reverseForInvoice,
  scheduleAlertChecks,
} from './invoice-ops.js'
export type { InvoiceStockItem } from './invoice-ops.js'

export { validateStockForInvoice } from './validation.js'
