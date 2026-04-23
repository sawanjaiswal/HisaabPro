/**
 * Thin re-export shim — implementation lives in report/ module.
 * Kept for backward-compat with import in routes/reports.ts.
 */
export {
  getInvoiceReport,
  getPartyStatement,
  getStockSummary,
  getDayBook,
  getPaymentHistory,
  exportReport,
} from './report/index.js'
