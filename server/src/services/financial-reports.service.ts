/**
 * Financial Reports Service — P&L, Balance Sheet, Cash Flow, Aging, Profitability, Tally Export
 *
 * All amounts are stored in PAISE (integer). Results are returned in PAISE.
 * The caller (route) decides how to format for display (divide by 100 for rupees).
 *
 * Double-entry convention:
 *   ASSET / EXPENSE accounts: debit-normal (debit increases, credit decreases)
 *   LIABILITY / EQUITY / INCOME accounts: credit-normal (credit increases, debit decreases)
 *
 * P&L period: INCOME net credit − EXPENSE net debit
 * Balance Sheet: ASSET accounts | LIABILITY + EQUITY accounts + retained earnings
 */

import { prisma } from '../lib/prisma.js'

// ─── Internal types ────────────────────────────────────────────────────────────

interface AccountNetMovement {
  accountId: string
  accountName: string
  accountType: string
  accountSubType: string | null
  netDebit: number
  netCredit: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum journal line movements for accounts filtered by type, within a date range */
async function getAccountMovements(
  businessId: string,
  dateGte: Date,
  dateLte: Date,
  accountTypes: string[],
): Promise<AccountNetMovement[]> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        businessId,
        status: 'POSTED',
        date: { gte: dateGte, lte: dateLte },
      },
      account: {
        type: { in: accountTypes },
        isActive: true,
      },
    },
    select: {
      debit: true,
      credit: true,
      account: {
        select: { id: true, name: true, type: true, subType: true },
      },
    },
  })

  // Aggregate by account
  const map = new Map<
    string,
    { accountName: string; accountType: string; accountSubType: string | null; debit: number; credit: number }
  >()

  for (const line of lines) {
    const existing = map.get(line.account.id)
    if (existing) {
      existing.debit += line.debit
      existing.credit += line.credit
    } else {
      map.set(line.account.id, {
        accountName: line.account.name,
        accountType: line.account.type,
        accountSubType: line.account.subType,
        debit: line.debit,
        credit: line.credit,
      })
    }
  }

  return Array.from(map.entries()).map(([accountId, v]) => ({
    accountId,
    accountName: v.accountName,
    accountType: v.accountType,
    accountSubType: v.accountSubType,
    netDebit: v.debit,
    netCredit: v.credit,
  }))
}

/**
 * Calculate account balances as of a specific date by summing journal movements.
 * Returns net balance (debit - credit for ASSET/EXPENSE, credit - debit for LIABILITY/EQUITY/INCOME).
 */
async function getBalancesAsOf(
  businessId: string,
  asOf: Date,
): Promise<Map<string, { name: string; type: string; subType: string | null; netBalance: number }>> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        businessId,
        status: 'POSTED',
        date: { lte: asOf },
      },
    },
    select: {
      debit: true,
      credit: true,
      account: {
        select: { id: true, name: true, type: true, subType: true },
      },
    },
  })

  const map = new Map<
    string,
    { name: string; type: string; subType: string | null; totalDebit: number; totalCredit: number }
  >()

  for (const line of lines) {
    const existing = map.get(line.account.id)
    if (existing) {
      existing.totalDebit += line.debit
      existing.totalCredit += line.credit
    } else {
      map.set(line.account.id, {
        name: line.account.name,
        type: line.account.type,
        subType: line.account.subType,
        totalDebit: line.debit,
        totalCredit: line.credit,
      })
    }
  }

  const result = new Map<
    string,
    { name: string; type: string; subType: string | null; netBalance: number }
  >()

  for (const [id, v] of map.entries()) {
    let netBalance: number
    if (v.type === 'ASSET' || v.type === 'EXPENSE') {
      // Debit-normal: positive = debit balance
      netBalance = v.totalDebit - v.totalCredit
    } else {
      // Credit-normal: positive = credit balance
      netBalance = v.totalCredit - v.totalDebit
    }
    result.set(id, { name: v.name, type: v.type, subType: v.subType, netBalance })
  }

  return result
}

// ─── P&L ──────────────────────────────────────────────────────────────────────

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

// ─── Balance Sheet ─────────────────────────────────────────────────────────────

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

// ─── Cash Flow Statement ──────────────────────────────────────────────────────

export async function getCashFlowStatement(businessId: string, from: Date, to: Date) {
  // Compute P&L for the period to get net profit
  const pnl = await getProfitAndLoss(businessId, from, to)

  // Get account balances as of `from` (opening) and `to` (closing)
  const openingBalances = await getBalancesAsOf(businessId, new Date(from.getTime() - 1))
  const closingBalances = await getBalancesAsOf(businessId, to)

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

// ─── Aging Report ─────────────────────────────────────────────────────────────

export async function getAgingReport(
  businessId: string,
  type: 'RECEIVABLE' | 'PAYABLE',
  asOf?: Date,
) {
  const referenceDate = asOf ?? new Date()

  const docType = type === 'RECEIVABLE' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE'

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: docType,
      status: { not: 'DELETED' },
      balanceDue: { gt: 0 },
      documentDate: { lte: referenceDate },
    },
    select: {
      id: true,
      partyId: true,
      balanceDue: true,
      documentDate: true,
      dueDate: true,
      party: { select: { id: true, name: true } },
    },
  })

  type AgingBuckets = {
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days91to120: number
    over120: number
    total: number
  }

  const partyMap = new Map<
    string,
    { partyId: string; partyName: string } & AgingBuckets
  >()

  const summary: AgingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days91to120: 0,
    over120: 0,
    total: 0,
  }

  const msPerDay = 24 * 60 * 60 * 1000

  for (const doc of docs) {
    const dueAt = doc.dueDate ?? doc.documentDate
    const ageMs = referenceDate.getTime() - dueAt.getTime()
    const ageDays = Math.floor(ageMs / msPerDay)
    const amount = doc.balanceDue

    let bucket: keyof AgingBuckets = 'current'
    if (ageDays <= 0) bucket = 'current'
    else if (ageDays <= 30) bucket = 'days1to30'
    else if (ageDays <= 60) bucket = 'days31to60'
    else if (ageDays <= 90) bucket = 'days61to90'
    else if (ageDays <= 120) bucket = 'days91to120'
    else bucket = 'over120'

    // Update summary
    summary[bucket] += amount
    summary.total += amount

    // Update per-party
    const existing = partyMap.get(doc.partyId)
    if (existing) {
      existing[bucket] += amount
      existing.total += amount
    } else {
      partyMap.set(doc.partyId, {
        partyId: doc.partyId,
        partyName: doc.party.name,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91to120: 0,
        over120: 0,
        total: 0,
        [bucket]: amount,
      })
      partyMap.get(doc.partyId)!.total = amount
    }
  }

  return {
    type,
    asOf: referenceDate,
    summary,
    parties: Array.from(partyMap.values()).sort((a, b) => b.total - a.total),
  }
}

// ─── Profitability Report ──────────────────────────────────────────────────────

export async function getProfitabilityReport(
  businessId: string,
  from: Date,
  to: Date,
  groupBy: 'PARTY' | 'PRODUCT' | 'DOCUMENT',
) {
  type ProfitItem = {
    id: string
    name: string
    revenue: number
    cost: number
    profit: number
    profitPercent: number
  }

  const items: ProfitItem[] = []

  if (groupBy === 'PARTY') {
    const docs = await prisma.document.findMany({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { not: 'DELETED' },
        documentDate: { gte: from, lte: to },
      },
      select: {
        partyId: true,
        grandTotal: true,
        totalCost: true,
        totalProfit: true,
        party: { select: { id: true, name: true } },
      },
    })

    const partyMap = new Map<
      string,
      { name: string; revenue: number; cost: number }
    >()

    for (const doc of docs) {
      const existing = partyMap.get(doc.partyId)
      if (existing) {
        existing.revenue += doc.grandTotal
        existing.cost += doc.totalCost
      } else {
        partyMap.set(doc.partyId, {
          name: doc.party.name,
          revenue: doc.grandTotal,
          cost: doc.totalCost,
        })
      }
    }

    for (const [id, v] of partyMap.entries()) {
      const profit = v.revenue - v.cost
      items.push({
        id,
        name: v.name,
        revenue: v.revenue,
        cost: v.cost,
        profit,
        profitPercent: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      })
    }
  } else if (groupBy === 'PRODUCT') {
    const lineItems = await prisma.documentLineItem.findMany({
      where: {
        document: {
          businessId,
          type: 'SALE_INVOICE',
          status: { not: 'DELETED' },
          documentDate: { gte: from, lte: to },
        },
      },
      select: {
        productId: true,
        lineTotal: true,
        purchasePrice: true,
        quantity: true,
        product: { select: { id: true, name: true } },
      },
    })

    const productMap = new Map<
      string,
      { name: string; revenue: number; cost: number }
    >()

    for (const li of lineItems) {
      const cost = Math.round(li.purchasePrice * li.quantity)
      const existing = productMap.get(li.productId)
      if (existing) {
        existing.revenue += li.lineTotal
        existing.cost += cost
      } else {
        productMap.set(li.productId, {
          name: li.product.name,
          revenue: li.lineTotal,
          cost,
        })
      }
    }

    for (const [id, v] of productMap.entries()) {
      const profit = v.revenue - v.cost
      items.push({
        id,
        name: v.name,
        revenue: v.revenue,
        cost: v.cost,
        profit,
        profitPercent: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      })
    }
  } else {
    // DOCUMENT
    const docs = await prisma.document.findMany({
      where: {
        businessId,
        type: 'SALE_INVOICE',
        status: { not: 'DELETED' },
        documentDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        documentNumber: true,
        grandTotal: true,
        totalCost: true,
        totalProfit: true,
        profitPercent: true,
      },
    })

    for (const doc of docs) {
      items.push({
        id: doc.id,
        name: doc.documentNumber ?? doc.id,
        revenue: doc.grandTotal,
        cost: doc.totalCost,
        profit: doc.totalProfit,
        profitPercent: doc.profitPercent,
      })
    }
  }

  // Sort by revenue descending
  items.sort((a, b) => b.revenue - a.revenue)

  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const totalCost = items.reduce((s, i) => s + i.cost, 0)
  const totalProfit = totalRevenue - totalCost

  return {
    groupBy,
    period: { from, to },
    items,
    totals: {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      profitPercent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    },
  }
}

// ─── Discount Report ──────────────────────────────────────────────────────────

export async function getDiscountReport(businessId: string, from: Date, to: Date) {
  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: 'SALE_INVOICE',
      status: { not: 'DELETED' },
      documentDate: { gte: from, lte: to },
      totalDiscount: { gt: 0 },
    },
    select: {
      id: true,
      documentNumber: true,
      subtotal: true,
      totalDiscount: true,
      partyId: true,
      party: { select: { id: true, name: true } },
    },
  })

  const totalDiscount = docs.reduce((s, d) => s + d.totalDiscount, 0)

  const byDocument = docs.map((d) => ({
    documentNumber: d.documentNumber ?? d.id,
    partyName: d.party.name,
    subtotal: d.subtotal,
    discount: d.totalDiscount,
    discountPercent: d.subtotal > 0 ? (d.totalDiscount / d.subtotal) * 100 : 0,
  }))

  // Group by party
  const partyMap = new Map<
    string,
    { partyName: string; totalDiscount: number; invoiceCount: number }
  >()

  for (const d of docs) {
    const existing = partyMap.get(d.partyId)
    if (existing) {
      existing.totalDiscount += d.totalDiscount
      existing.invoiceCount += 1
    } else {
      partyMap.set(d.partyId, {
        partyName: d.party.name,
        totalDiscount: d.totalDiscount,
        invoiceCount: 1,
      })
    }
  }

  const byParty = Array.from(partyMap.values()).sort((a, b) => b.totalDiscount - a.totalDiscount)

  return {
    period: { from, to },
    totalDiscount,
    byDocument,
    byParty,
  }
}

// ─── Tally Export ─────────────────────────────────────────────────────────────

/** Format date as YYYYMMDD for Tally */
function tallyDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Convert paise to rupees string for Tally (2 decimal places) */
function tallyAmount(paise: number): string {
  return (paise / 100).toFixed(2)
}

/** Map our journal entry type to Tally voucher type */
function tallyJournalVoucherType(jeType: string): string {
  const map: Record<string, string> = {
    SALES: 'Sales',
    PURCHASE: 'Purchase',
    RECEIPT: 'Receipt',
    PAYMENT: 'Payment',
    CONTRA: 'Contra',
    JOURNAL: 'Journal',
    EXPENSE: 'Payment',
    CREDIT_NOTE: 'Credit Note',
    DEBIT_NOTE: 'Debit Note',
    OPENING: 'Journal',
    FY_CLOSURE: 'Journal',
  }
  return map[jeType] ?? 'Journal'
}

export async function getTallyExport(businessId: string, from: Date, to: Date): Promise<string> {
  // Fetch all posted journal entries in the date range
  const entries = await prisma.journalEntry.findMany({
    where: {
      businessId,
      status: 'POSTED',
      date: { gte: from, lte: to },
    },
    select: {
      id: true,
      entryNumber: true,
      date: true,
      narration: true,
      type: true,
      sourceNumber: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          narration: true,
          account: { select: { name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
  })

  // Fetch all active ledger accounts for the business (for ledger masters export)
  const accounts = await prisma.ledgerAccount.findMany({
    where: { businessId, isActive: true },
    select: { name: true, type: true, subType: true },
  })

  /** Map our account type to Tally parent group */
  const tallyGroup = (type: string, subType: string | null): string => {
    if (type === 'ASSET') {
      if (subType === 'CASH') return 'Cash-in-Hand'
      if (subType === 'BANK') return 'Bank Accounts'
      if (subType === 'RECEIVABLE') return 'Sundry Debtors'
      if (subType === 'INVENTORY') return 'Stock-in-Hand'
      if (subType === 'FIXED_ASSET') return 'Fixed Assets'
      return 'Current Assets'
    }
    if (type === 'LIABILITY') {
      if (subType === 'PAYABLE') return 'Sundry Creditors'
      if (subType === 'TAX') return 'Duties & Taxes'
      if (subType === 'LOAN') return 'Loans (Liability)'
      return 'Current Liabilities'
    }
    if (type === 'EQUITY') return "Capital Account"
    if (type === 'INCOME') return 'Sales Accounts'
    if (type === 'EXPENSE') {
      if (subType === 'PURCHASE') return 'Purchase Accounts'
      return 'Indirect Expenses'
    }
    return 'Miscellaneous Expenses (ASSET)'
  }

  const ledgerMasters = accounts
    .map(
      (a) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${escapeXml(a.name)}" RESERVEDNAME="">
        <PARENT>${escapeXml(tallyGroup(a.type, a.subType))}</PARENT>
      </LEDGER>
    </TALLYMESSAGE>`,
    )
    .join('')

  const vouchers = entries
    .map((je) => {
      const voucherType = tallyJournalVoucherType(je.type)
      const refNumber = je.sourceNumber ?? je.entryNumber

      const ledgerEntries = je.lines
        .map((line) => {
          // In Tally: ISDEEMEDPOSITIVE is TRUE for debit lines in Dr/Cr vouchers
          const isDebit = line.debit > 0
          const amount = isDebit ? line.debit : line.credit
          // For Sales/Purchase/Journal: debit lines have ISDEEMEDPOSITIVE=YES
          const isDeemedPositive = isDebit ? 'Yes' : 'No'
          return `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(line.account.name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${isDeemedPositive}</ISDEEMEDPOSITIVE>
          <AMOUNT>${isDebit ? tallyAmount(amount) : `-${tallyAmount(amount)}`}</AMOUNT>
          ${line.narration ? `<NARRATION>${escapeXml(line.narration)}</NARRATION>` : ''}
        </ALLLEDGERENTRIES.LIST>`
        })
        .join('')

      return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER REMOTEID="${escapeXml(je.id)}" VCHTYPE="${escapeXml(voucherType)}" ACTION="Create">
        <DATE>${tallyDate(je.date)}</DATE>
        <VOUCHERTYPENAME>${escapeXml(voucherType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${escapeXml(refNumber ?? je.entryNumber)}</VOUCHERNUMBER>
        ${je.narration ? `<NARRATION>${escapeXml(je.narration)}</NARRATION>` : ''}
        ${ledgerEntries}
      </VOUCHER>
    </TALLYMESSAGE>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>$$CurrentCompany</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${ledgerMasters}
        ${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
