/**
 * Balance Sheet Report
 *
 * Balance Sheet: ASSET accounts | LIABILITY + EQUITY accounts + retained earnings
 */

import { getBalancesAsOf } from './helpers.js'

export async function getBalanceSheet(businessId: string, asOf: Date) {
  const balances = await getBalancesAsOf(businessId, asOf)

  // Classify accounts
  type BalanceItem = { name: string; balance: number }

  const fixedAssetSubTypes = ['FIXED_ASSET']
  const longTermLiabilitySubTypes = ['LOAN']

  const currentAssets: BalanceItem[] = []
  const fixedAssets: BalanceItem[] = []
  const currentLiabilities: BalanceItem[] = []
  const longTermLiabilities: BalanceItem[] = []
  const equityItems: BalanceItem[] = []

  for (const [, v] of balances.entries()) {
    if (v.netBalance === 0) continue

    if (v.type === 'ASSET') {
      if (v.subType && fixedAssetSubTypes.includes(v.subType)) {
        fixedAssets.push({ name: v.name, balance: v.netBalance })
      } else {
        // Default to current asset (includes CASH, BANK, RECEIVABLE, INVENTORY, and others)
        currentAssets.push({ name: v.name, balance: v.netBalance })
      }
    } else if (v.type === 'LIABILITY') {
      if (v.subType && longTermLiabilitySubTypes.includes(v.subType)) {
        longTermLiabilities.push({ name: v.name, balance: v.netBalance })
      } else {
        // Default current liability (PAYABLE, TAX, and others)
        currentLiabilities.push({ name: v.name, balance: v.netBalance })
      }
    } else if (v.type === 'EQUITY') {
      equityItems.push({ name: v.name, balance: v.netBalance })
    }
    // INCOME/EXPENSE accounts are not on the balance sheet directly —
    // their net effect flows into retained earnings below
  }

  // Calculate retained earnings: net P&L for all time up to asOf
  // Income (credit-normal): netBalance positive = credit
  // Expense (debit-normal): netBalance positive = debit
  let retainedEarnings = 0
  for (const [, v] of balances.entries()) {
    if (v.type === 'INCOME') {
      retainedEarnings += v.netBalance
    } else if (v.type === 'EXPENSE') {
      retainedEarnings -= v.netBalance
    }
  }

  if (retainedEarnings !== 0) {
    equityItems.push({ name: 'Retained Earnings', balance: retainedEarnings })
  }

  const totalCurrentAssets = currentAssets.reduce((s, i) => s + i.balance, 0)
  const totalFixedAssets = fixedAssets.reduce((s, i) => s + i.balance, 0)
  const totalAssets = totalCurrentAssets + totalFixedAssets

  const totalCurrentLiabilities = currentLiabilities.reduce((s, i) => s + i.balance, 0)
  const totalLongTermLiabilities = longTermLiabilities.reduce((s, i) => s + i.balance, 0)
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

  const totalEquity = equityItems.reduce((s, i) => s + i.balance, 0)

  return {
    asOf,
    assets: {
      current: { items: currentAssets, total: totalCurrentAssets },
      fixed: { items: fixedAssets, total: totalFixedAssets },
      totalAssets,
    },
    liabilities: {
      current: { items: currentLiabilities, total: totalCurrentLiabilities },
      longTerm: { items: longTermLiabilities, total: totalLongTermLiabilities },
      totalLiabilities,
    },
    equity: {
      items: equityItems,
      totalEquity,
    },
    // accounting equation check: totalAssets should equal totalLiabilities + totalEquity
    balanced: totalAssets === totalLiabilities + totalEquity,
  }
}
