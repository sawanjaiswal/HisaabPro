/**
 * S1 regression guard — expense create/update/delete must route through the
 * GL bridge so manual expenses post, and edits/deletes reverse, the journal.
 *
 * The bug: GL posting was wired only into the recurring confirm path
 * (expense-confirm.service.ts), so manually-created CONFIRMED expenses never
 * posted, and editing/deleting a posted expense stranded ledger balances.
 *
 * Uses the global prisma mock ($transaction(fn) runs fn(prisma)). The GL
 * bridge is mocked so we assert the lifecycle wiring; postExpense /
 * persistPosting arithmetic is covered by posting.maps + ledger-deltas tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../../../lib/prisma.js'
import { createExpense, updateExpense, deleteExpense } from '../../expense.service.js'
import { postExpenseToGL, reverseExpenseGL } from '../expense-gl.js'

vi.mock('../expense-gl.js', () => ({
  postExpenseToGL: vi.fn().mockResolvedValue(undefined),
  reverseExpenseGL: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../notifications/notification-manager.js', () => ({
  notificationManager: { notify: vi.fn() },
}))
vi.mock('../../notifications/notification-template.service.js', () => ({
  formatPaise: vi.fn().mockReturnValue('₹0'),
}))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const USER_ID = 'user-1'
const EXPENSE_ID = 'exp-1'
const ROW = {
  id: EXPENSE_ID,
  amount: 10000,
  gstAmount: 0,
  paymentMode: 'CASH',
  date: new Date('2026-05-29'),
  category: { id: 'cat-1', name: 'Rent' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' })
})

describe('createExpense — GL posting', () => {
  it('posts a CONFIRMED expense to the GL', async () => {
    mockPrisma.expense.create.mockResolvedValue(ROW)
    await createExpense(BUSINESS_ID, USER_ID, {
      categoryId: 'cat-1', amount: 10000, date: new Date('2026-05-29'), paymentMode: 'CASH',
    } as never)
    expect(postExpenseToGL).toHaveBeenCalledTimes(1)
    expect(postExpenseToGL).toHaveBeenCalledWith(expect.anything(), BUSINESS_ID, USER_ID, ROW)
  })
})

describe('updateExpense — GL reverse + re-post', () => {
  beforeEach(() => mockPrisma.expense.findFirst.mockResolvedValue({ id: EXPENSE_ID }))

  it('reverses then re-posts when the expense is CONFIRMED', async () => {
    mockPrisma.expense.update.mockResolvedValue({ ...ROW, status: 'CONFIRMED' })
    await updateExpense(BUSINESS_ID, EXPENSE_ID, USER_ID, { amount: 20000 } as never)
    expect(reverseExpenseGL).toHaveBeenCalledTimes(1)
    expect(postExpenseToGL).toHaveBeenCalledTimes(1)
  })

  it('reverses but does NOT re-post when the expense is still PENDING', async () => {
    mockPrisma.expense.update.mockResolvedValue({ ...ROW, status: 'PENDING_CONFIRMATION' })
    await updateExpense(BUSINESS_ID, EXPENSE_ID, USER_ID, { amount: 20000 } as never)
    expect(reverseExpenseGL).toHaveBeenCalledTimes(1)
    expect(postExpenseToGL).not.toHaveBeenCalled()
  })
})

describe('deleteExpense — GL reversal', () => {
  it('reverses the posted journal entry before soft-deleting', async () => {
    mockPrisma.expense.findFirst.mockResolvedValue({ id: EXPENSE_ID })
    mockPrisma.expense.update.mockResolvedValue({ id: EXPENSE_ID })
    await deleteExpense(BUSINESS_ID, EXPENSE_ID)
    expect(reverseExpenseGL).toHaveBeenCalledTimes(1)
    expect(reverseExpenseGL).toHaveBeenCalledWith(expect.anything(), BUSINESS_ID, EXPENSE_ID, 'Expense deleted')
  })
})
