/**
 * Single Source of Truth for Document Financial & Inventory Delta Rules.
 * Operates at Level 6 Architecture Protocol — strictly matches server domain rules.
 */

export const STOCK_DECREASE_TYPES = new Set(['SALE_INVOICE', 'DELIVERY_CHALLAN', 'DEBIT_NOTE']);
export const STOCK_INCREASE_TYPES = new Set(['PURCHASE_INVOICE', 'CREDIT_NOTE']);
export const AFFECTS_OUTSTANDING = new Set(['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE']);

/**
 * Calculates the net party balance delta in paise.
 * Positive = increases receivable (or reduces payable).
 * Negative = decreases receivable (or increases payable).
 */
export function getDocumentOutstandingDelta(type: string, balance: number): number {
  switch (type) {
    case 'SALE_INVOICE':
      return balance; // Customer owes us
    case 'PURCHASE_INVOICE':
      return -balance; // We owe supplier
    case 'CREDIT_NOTE':
      return -balance; // Sales return: customer owes us less
    case 'DEBIT_NOTE':
      return balance; // Purchase return: we owe supplier less
    default:
      return 0; // ESTIMATE, PROFORMA, SALE_ORDER, PURCHASE_ORDER do NOT alter party balance
  }
}

/**
 * Calculates the inventory stock delta.
 * Negative = stock leaves warehouse.
 * Positive = stock enters warehouse.
 */
export function getDocumentStockDelta(type: string, quantity: number): number {
  if (STOCK_DECREASE_TYPES.has(type)) {
    return -quantity;
  }
  if (STOCK_INCREASE_TYPES.has(type)) {
    return quantity;
  }
  return 0; // ESTIMATE, PROFORMA, SALE_ORDER, PURCHASE_ORDER do NOT affect physical stock
}
