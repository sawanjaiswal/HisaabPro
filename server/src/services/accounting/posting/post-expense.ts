/**
 * Post a confirmed Expense to the GL.
 * Call inside confirmExpense's transaction, after the status flips to CONFIRMED.
 */
import { mapExpense, type ExpenseForPosting } from './posting.maps.js'
import { persistPosting } from './index.js'
import type { Tx } from './posting.types.js'

export interface PostExpenseArgs {
  businessId: string
  userId: string
  expense: ExpenseForPosting & { id: string; date: Date }
}

export async function postExpense(tx: Tx, { businessId, userId, expense }: PostExpenseArgs) {
  const map = mapExpense(expense)
  return persistPosting(
    tx,
    {
      businessId,
      userId,
      date: expense.date,
      narration: `Expense — ${expense.categoryName}`,
      sourceType: 'EXPENSE',
      sourceId: expense.id,
      sourceNumber: null,
    },
    map,
  )
}
