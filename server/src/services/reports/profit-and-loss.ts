/**
 * Profit & Loss Report
 *
 * P&L period: INCOME net credit - EXPENSE net debit
 */

import { getAccountMovements } from './helpers.js'

export async function getProfitAndLoss(businessId: string, from: Date, to: Date) {
  const movements = await getAccountMovements(businessId, from, to, ['INCOME', 'EXPENSE'])

  // Income accounts: credit-normal — net income = credit - debit
  const incomeLines = movements
    .filter((m) => m.accountType === 'INCOME')
    .map((m) => ({
      accountName: m.accountName,
      subType: m.accountSubType,
      amount: m.netCredit - m.netDebit,
    }))
    .filter((l) => l.amount !== 0)

  // Expense accounts: debit-normal — net expense = debit - credit
  const expenseLines = movements
    .filter((m) => m.accountType === 'EXPENSE')
    .map((m) => ({
      accountName: m.accountName,
      subType: m.accountSubType,
      amount: m.netDebit - m.netCredit,
    }))
    .filter((l) => l.amount !== 0)

  // Income breakdown
  const sales = incomeLines
    .filter((l) => l.subType === 'REVENUE')
    .reduce((sum, l) => sum + l.amount, 0)

  const otherIncome = incomeLines
    .filter((l) => l.subType !== 'REVENUE')
    .reduce((sum, l) => sum + l.amount, 0)

  const totalIncome = sales + otherIncome

  // Expense breakdown
  const purchases = expenseLines
    .filter((l) => l.subType === 'PURCHASE')
    .reduce((sum, l) => sum + l.amount, 0)

  const directExpenses = expenseLines
    .filter((l) => l.subType === 'DIRECT_EXPENSE')
    .reduce((sum, l) => sum + l.amount, 0)

  const indirectExpenses = expenseLines
    .filter((l) => l.subType !== 'PURCHASE' && l.subType !== 'DIRECT_EXPENSE')
    .reduce((sum, l) => sum + l.amount, 0)

  const totalExpenses = purchases + directExpenses + indirectExpenses

  const grossProfit = sales - purchases - directExpenses
  const netProfit = totalIncome - totalExpenses

  return {
    period: { from, to },
    income: {
      sales,
      otherIncome,
      totalIncome,
      breakdown: incomeLines.map((l) => ({ accountName: l.accountName, amount: l.amount })),
    },
    expenses: {
      purchases,
      directExpenses,
      indirectExpenses,
      totalExpenses,
      breakdown: expenseLines.map((l) => ({ accountName: l.accountName, amount: l.amount })),
    },
    grossProfit,
    netProfit,
  }
}
