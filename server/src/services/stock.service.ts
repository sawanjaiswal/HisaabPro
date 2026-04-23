/**
 * @deprecated Import from './stock/index.js' directly.
 * This barrel exists for backward-compatibility while callers migrate.
 */
export {
  adjustStock,
  deductForSaleInvoice,
  addForPurchaseInvoice,
  reverseForInvoice,
  scheduleAlertChecks,
  validateStockForInvoice,
} from './stock/index.js'

export type { AdjustStockParams, InvoiceStockItem } from './stock/index.js'
