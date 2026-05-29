/**
 * Pure posting maps — turn a source record into balanced double-entry lines.
 *
 * Every map is a pure function: domain object → PostingMap. Σdebit must equal
 * Σcredit by construction. All amounts in paise. Accounts referenced by seeded
 * code (resolved later). Zero-value legs are dropped so entries stay clean.
 *
 * Field ground-truth verified against document-calc.ts:
 *   grandTotal = subtotal + totalAdditionalCharges + totalTax + roundOff
 *   (does NOT include tdsAmount / tcsAmount — those are separate columns)
 *   subtotal is NET of discount (document-calc.ts:32) → revenue posts from it
 *   totalTaxableValue is GST-lines-only (0 under composition) → NOT used here
 */
import type { PostingLine, PostingMap } from './posting.types.js'

export interface DocumentForPosting {
  type: string // SALE_INVOICE, PURCHASE_INVOICE, CREDIT_NOTE, DEBIT_NOTE
  partyId: string
  subtotal: number
  totalAdditionalCharges: number
  roundOff: number
  grandTotal: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  tdsAmount: number
  tcsAmount: number
  totalCost: number
}

export interface PaymentForPosting {
  type: string // PAYMENT_IN, PAYMENT_OUT
  mode: string // CASH, UPI, BANK_TRANSFER, CHEQUE, …
  amount: number
  partyId: string
}

export interface ExpenseForPosting {
  amount: number // paise — total outflow (tax-inclusive)
  gstAmount: number // paise — ITC component within amount
  paymentMode: string // CASH, UPI, BANK_TRANSFER, …
  categoryName: string
}

const push = (lines: PostingLine[], code: string, debit: number, credit: number, narration?: string, partyId?: string) => {
  if (debit === 0 && credit === 0) return
  lines.push({ code, debit, credit, narration, partyId })
}

/** Cash if literal CASH, else Bank. */
const cashOrBank = (mode: string): string => (mode === 'CASH' ? '1000' : '1100')

/** Sum of all GST + cess components. */
const taxOf = (d: DocumentForPosting) => d.totalCgst + d.totalSgst + d.totalIgst + d.totalCess

/** Swap debit/credit on every line (used to mirror SALE→CREDIT_NOTE, PURCHASE→DEBIT_NOTE). */
const mirror = (lines: PostingLine[]): PostingLine[] =>
  lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }))

/** SALE invoice → AR/Revenue/Tax/charges/TDS/TCS/round-off + COGS cost side. */
export function mapSaleInvoice(d: DocumentForPosting): PostingMap {
  const lines: PostingLine[] = []
  // Receivable side
  push(lines, '1200', d.grandTotal - d.tdsAmount + d.tcsAmount, 0, 'Accounts receivable', d.partyId)
  push(lines, '1250', d.tdsAmount, 0, 'TDS deducted by customer')
  if (d.roundOff < 0) push(lines, '5400', -d.roundOff, 0, 'Round off')
  // Income side
  push(lines, '4000', 0, d.subtotal, 'Sales revenue')
  push(lines, '2100', 0, taxOf(d), 'Output tax')
  push(lines, '4100', 0, d.totalAdditionalCharges, 'Additional charges')
  push(lines, '2300', 0, d.tcsAmount, 'TCS collected')
  if (d.roundOff > 0) push(lines, '5400', 0, d.roundOff, 'Round off')
  // Cost of goods sold (skip when unknown — never fabricate)
  if (d.totalCost > 0) {
    push(lines, '5050', d.totalCost, 0, 'Cost of goods sold')
    push(lines, '1300', 0, d.totalCost, 'Inventory reduction')
  }
  return { type: 'SALES', lines }
}

/** PURCHASE invoice → Inventory/ITC/AP/TDS/TCS/round-off. */
export function mapPurchaseInvoice(d: DocumentForPosting): PostingMap {
  const lines: PostingLine[] = []
  // Asset / input-tax side
  push(lines, '1300', d.subtotal + d.totalAdditionalCharges, 0, 'Inventory / purchases')
  push(lines, '2100', taxOf(d), 0, 'Input tax credit')
  push(lines, '2300', d.tcsAmount, 0, 'TCS paid')
  if (d.roundOff < 0) push(lines, '5400', -d.roundOff, 0, 'Round off')
  // Payable side
  push(lines, '2000', 0, d.grandTotal - d.tdsAmount + d.tcsAmount, 'Accounts payable', d.partyId)
  push(lines, '2200', 0, d.tdsAmount, 'TDS withheld from supplier')
  if (d.roundOff > 0) push(lines, '5400', 0, d.roundOff, 'Round off')
  return { type: 'PURCHASE', lines }
}

/** Dispatch a Document to the right map by type. */
export function mapDocument(d: DocumentForPosting): PostingMap {
  switch (d.type) {
    case 'SALE_INVOICE':
      return mapSaleInvoice(d)
    case 'PURCHASE_INVOICE':
      return mapPurchaseInvoice(d)
    case 'CREDIT_NOTE':
      return { type: 'CREDIT_NOTE', lines: mirror(mapSaleInvoice(d).lines) }
    case 'DEBIT_NOTE':
      return { type: 'DEBIT_NOTE', lines: mirror(mapPurchaseInvoice(d).lines) }
    default:
      return { type: 'JOURNAL', lines: [] }
  }
}

/** PAYMENT_IN → Dr Cash/Bank, Cr AR. PAYMENT_OUT → Dr AP, Cr Cash/Bank. */
export function mapPayment(p: PaymentForPosting): PostingMap {
  const lines: PostingLine[] = []
  const cb = cashOrBank(p.mode)
  if (p.type === 'PAYMENT_IN') {
    push(lines, cb, p.amount, 0, 'Payment received')
    push(lines, '1200', 0, p.amount, 'Settle receivable', p.partyId)
    return { type: 'RECEIPT', lines }
  }
  push(lines, '2000', p.amount, 0, 'Settle payable', p.partyId)
  push(lines, cb, 0, p.amount, 'Payment made')
  return { type: 'PAYMENT', lines }
}

const DIRECT_HINTS = ['purchase', 'raw material', 'freight inward', 'carriage inward', 'direct']

/** Confirmed expense → Dr Expense + ITC, Cr Cash/Bank. */
export function mapExpense(e: ExpenseForPosting): PostingMap {
  const lines: PostingLine[] = []
  const isDirect = DIRECT_HINTS.some((h) => e.categoryName.toLowerCase().includes(h))
  const expenseCode = isDirect ? '5100' : '5200'
  push(lines, expenseCode, e.amount - e.gstAmount, 0, e.categoryName)
  push(lines, '2100', e.gstAmount, 0, 'Input tax credit')
  push(lines, cashOrBank(e.paymentMode), 0, e.amount, 'Expense paid')
  return { type: 'EXPENSE', lines }
}
