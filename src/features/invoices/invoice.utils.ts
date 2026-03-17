/** Invoice Utils — Barrel re-export
 *
 * Original file split into:
 *   - invoice-calc.utils.ts     (calculation engine)
 *   - invoice-format.utils.ts   (formatting + paise/rupees)
 *   - invoice-document.utils.ts (document helpers)
 *
 * This file re-exports everything for backward compatibility.
 * Prefer importing from the specific file directly.
 */

export {
  calculateLineTotal,
  calculateDiscount,
  calculateChargeAmount,
  calculateSubtotal,
  calculateTotalDiscount,
  calculateTotalCharges,
  calculateRoundOff,
  calculateGrandTotal,
} from './invoice-calc.utils'

export type {
  LineItemCalc,
  ChargeCalc,
  InvoiceTotals,
} from './invoice-calc.utils'

export {
  calculateLineProfit,
  calculateTotalProfit,
  calculateInvoiceTotals,
} from './invoice-totals.utils'

export {
  formatInvoiceAmount,
  formatInvoiceDate,
  paiseToRupees,
  rupeesToPaise,
} from './invoice-format.utils'

export {
  getPaymentStatus,
  getDaysOverdue,
  calculateDueDate,
  generateDocumentNumber,
  generateDefaultDocumentNumber,
  getCurrentFinancialYear,
  isConversionAllowed,
  getStockEffect,
  getOutstandingEffect,
} from './invoice-document.utils'
