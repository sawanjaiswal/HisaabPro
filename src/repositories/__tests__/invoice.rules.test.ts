import { describe, it, expect } from 'vitest';
import {
  STOCK_DECREASE_TYPES,
  STOCK_INCREASE_TYPES,
  AFFECTS_OUTSTANDING,
  getDocumentOutstandingDelta,
  getDocumentStockDelta,
} from '../invoice.rules';

describe('invoice.rules math SSOT parity', () => {
  it('correctly calculates outstanding balance delta in paise', () => {
    const amount = 500000; // Rs 5,000.00

    // Sale invoice: customer owes us (+)
    expect(getDocumentOutstandingDelta('SALE_INVOICE', amount)).toBe(500000);

    // Purchase invoice: we owe supplier (-)
    expect(getDocumentOutstandingDelta('PURCHASE_INVOICE', amount)).toBe(-500000);

    // Credit note (sales return): customer owes us less (-)
    expect(getDocumentOutstandingDelta('CREDIT_NOTE', amount)).toBe(-500000);

    // Debit note (purchase return): we owe supplier less (+)
    expect(getDocumentOutstandingDelta('DEBIT_NOTE', amount)).toBe(500000);

    // Non-fiscal document types must NEVER alter party balance
    expect(getDocumentOutstandingDelta('ESTIMATE', amount)).toBe(0);
    expect(getDocumentOutstandingDelta('PROFORMA', amount)).toBe(0);
    expect(getDocumentOutstandingDelta('SALE_ORDER', amount)).toBe(0);
    expect(getDocumentOutstandingDelta('PURCHASE_ORDER', amount)).toBe(0);
    expect(getDocumentOutstandingDelta('DELIVERY_CHALLAN', amount)).toBe(0);
  });

  it('correctly calculates inventory stock delta', () => {
    const qty = 10;

    // Goods leave warehouse (-)
    expect(getDocumentStockDelta('SALE_INVOICE', qty)).toBe(-10);
    expect(getDocumentStockDelta('DELIVERY_CHALLAN', qty)).toBe(-10);
    expect(getDocumentStockDelta('DEBIT_NOTE', qty)).toBe(-10);

    // Goods enter warehouse (+)
    expect(getDocumentStockDelta('PURCHASE_INVOICE', qty)).toBe(10);
    expect(getDocumentStockDelta('CREDIT_NOTE', qty)).toBe(10);

    // Non-inventory orders and estimates must NEVER alter physical stock
    expect(getDocumentStockDelta('ESTIMATE', qty)).toBe(0);
    expect(getDocumentStockDelta('PROFORMA', qty)).toBe(0);
    expect(getDocumentStockDelta('SALE_ORDER', qty)).toBe(0);
    expect(getDocumentStockDelta('PURCHASE_ORDER', qty)).toBe(0);
  });

  it('matches set invariants', () => {
    expect(STOCK_DECREASE_TYPES.has('SALE_INVOICE')).toBe(true);
    expect(STOCK_DECREASE_TYPES.has('DELIVERY_CHALLAN')).toBe(true);
    expect(STOCK_DECREASE_TYPES.has('DEBIT_NOTE')).toBe(true);

    expect(STOCK_INCREASE_TYPES.has('PURCHASE_INVOICE')).toBe(true);
    expect(STOCK_INCREASE_TYPES.has('CREDIT_NOTE')).toBe(true);

    expect(AFFECTS_OUTSTANDING.has('SALE_INVOICE')).toBe(true);
    expect(AFFECTS_OUTSTANDING.has('PURCHASE_INVOICE')).toBe(true);
    expect(AFFECTS_OUTSTANDING.has('CREDIT_NOTE')).toBe(true);
    expect(AFFECTS_OUTSTANDING.has('DEBIT_NOTE')).toBe(true);
    expect(AFFECTS_OUTSTANDING.has('ESTIMATE')).toBe(false);
  });
});
