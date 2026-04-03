/**
 * Cash Flow Statement (Indirect Method)
 *
 * Operating: Net Profit + working capital adjustments
 * Investing: Fixed asset changes
 * Financing: Loan changes
 */

import { getBalancesAsOf } from './helpers.js'
import { getProfitAndLoss } from './profit-and-loss.js'

export async function getCashFlowStatement(businessId: string, from: Date, to: Date) {
  // Compute P&L + opening/closing balances in parallel — all three are independent
  const [pnl, openingBalances, closingBalances] = await Promise.all([
    getProfitAndLoss(businessId, from, to),
    getBalancesAsOf(businessId, new Date(from.getTime() - 1)),
    getBalancesAsOf(businessId, to),
  ])

  // Opening and closing cash = CASH + BANK subtype accounts
  let openingCash = 0
  let closingCash = 0

  for (const [, v] of openingBalances.entries()) {
    if (v.type === 'ASSET' && (v.subType === 'CASH' || v.subType === 'BANK')) {
      openingCash += v.netBalance
    }
  }
  for (const [, v] of closingBalances.entries()) {
    if (v.type === 'ASSET' && (v.subType === 'CASH' || v.subType === 'BANK')) {
      closingCash += v.netBalance
    }
  }

  // Change in working capital components (from opening to closing)
  // Receivables increase = use of cash (subtract); decrease = source of cash (add)
  const deltaForAccount = (subType: string, accountType: string): number => {
    let openBal = 0
    let closeBal = 0

    for (const [, v] of openingBalances.entries()) {
      if (v.type === accountType && v.subType === subType) openBal += v.netBalance
    }
    for (const [, v] of closingBalances.entries()) {
      if (v.type === accountType && v.subType === subType) closeBal += v.netBalance
    }
    return closeBal - openBal
  }

  const receivablesDelta = deltaForAccount('RECEIVABLE', 'ASSET')
  const payablesDelta = deltaForAccount('PAYABLE', 'LIABILITY')
  const inventoryDelta = deltaForAccount('INVENTORY', 'ASSET')
  const taxPayableDelta = deltaForAccount('TAX', 'LIABILITY')

  // Operating adjustments (indirect method)
  // Increase in receivables = cash outflow (negative sign)
  // Increase in payables = cash inflow (positive sign)
  // Increase in inventory = cash outflow (negative sign)
  const operatingAdjustments = [
    { name: '(Increase)/Decrease in Receivables', amount: -receivablesDelta },
    { name: 'Increase/(Decrease) in Payables', amount: payablesDelta },
    { name: '(Increase)/Decrease in Inventory', amount: -inventoryDelta },
    { name: 'Increase/(Decrease) in Tax Payable', amount: taxPayableDelta },
  ].filter((a) => a.amount !== 0)

  const operatingAdjustmentsTotal = operatingAdjustments.reduce((s, a) => s + a.amount, 0)
  const netCashFromOperations = pnl.netProfit + operatingAdjustmentsTotal

  // Investing activities: fixed asset purchases / sales
  const fixedAssetDelta = deltaForAccount('FIXED_ASSET', 'ASSET')
  const investingItems = fixedAssetDelta !== 0
    ? [{ name: 'Purchase/(Sale) of Fixed Assets', amount: -fixedAssetDelta }]
    : []
  const netCashFromInvesting = investingItems.reduce((s, i) => s + i.amount, 0)

  // Financing activities: loans
  const loanDelta = deltaForAccount('LOAN', 'LIABILITY')
  const financingItems = loanDelta !== 0
    ? [{ name: 'Loan Proceeds/(Repayment)', amount: loanDelta }]
    : []
  const netCashFromFinancing = financingItems.reduce((s, i) => s + i.amount, 0)

  const netChange = netCashFromOperations + netCashFromInvesting + netCashFromFinancing

  return {
    period: { from, to },
    operating: {
      netProfit: pnl.netProfit,
      adjustments: operatingAdjustments,
      netCashFromOperations,
    },
    investing: {
      items: investingItems,
      netCashFromInvesting,
    },
    financing: {
      items: financingItems,
      netCashFromFinancing,
    },
    netChange,
    openingCash,
    closingCash,
  }
}
