/**
 * Expense → GL bridge. Wraps the single-writer posting layer with the
 * expense-row field mapping so the CRUD service stays thin. Posting and
 * reversal both run inside the caller's transaction (hard-atomic with the
 * expense mutation). Mirrors the payment lifecycle wiring.
 */
import { postExpense, reverseSourceEntry } from '../accounting/posting/index.js'
import type { Tx } from '../accounting/posting/posting.types.js'

export interface ExpenseGLRow {
  id: string
  amount: number
  gstAmount: number
  paymentMode: string
  date: Date
  category: { name: string }
}

/** Post a CONFIRMED expense to the GL: Dr Expense + ITC, Cr Cash/Bank. */
export async function postExpenseToGL(tx: Tx, businessId: string, userId: string, e: ExpenseGLRow) {
  await postExpense(tx, {
    businessId,
    userId,
    expense: {
      id: e.id,
      amount: e.amount,
      gstAmount: e.gstAmount,
      paymentMode: e.paymentMode,
      categoryName: e.category.name,
      date: e.date,
    },
  })
}

/** VOID the expense's posted journal entry (no-op if it was never posted). */
export async function reverseExpenseGL(tx: Tx, businessId: string, expenseId: string, reason: string) {
  await reverseSourceEntry(tx, businessId, 'EXPENSE', expenseId, reason)
}
