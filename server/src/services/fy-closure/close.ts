/**
 * Close FY — validates, builds closing journal entry, resets income/expense balances,
 * transfers net P&L to Retained Earnings, persists FinancialYearClosure record.
 */
import { prisma } from '../../lib/prisma.js'
import { validationError } from '../../lib/errors.js'
import { fyDateRange, buildClosureEntryNumber } from './helpers.js'
import { postLedgerDeltas, type BalanceLine } from '../accounting/posting/ledger-deltas.js'

type AccountAggregate = {
  name: string
  type: string
  currentBalance: number
  totalDebit: number
  totalCredit: number
}

type EntryLineInput = {
  accountId: string
  debit: number
  credit: number
  narration: string
  sortOrder: number
}

export async function closeFY(
  businessId: string,
  userId: string,
  financialYear: string,
) {
  // Validate FY string and parse date range
  const { from, to } = fyDateRange(financialYear)

  // Check for existing closure
  const existing = await prisma.financialYearClosure.findUnique({
    where: { businessId_financialYear: { businessId, financialYear } },
    select: { id: true, status: true },
  })
  if (existing && existing.status === 'CLOSED') {
    throw validationError(`Financial year ${financialYear} is already closed`)
  }

  // Fetch all INCOME and EXPENSE journal lines for the FY
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        businessId,
        status: 'POSTED',
        date: { gte: from, lte: to },
      },
      account: {
        type: { in: ['INCOME', 'EXPENSE'] },
        isActive: true,
      },
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
      account: {
        select: { id: true, name: true, type: true, balance: true },
      },
    },
  })

  // Aggregate net balances per account
  const accountMap = new Map<string, AccountAggregate>()

  for (const line of lines) {
    const acc = line.account
    const entry = accountMap.get(acc.id)
    if (entry) {
      entry.totalDebit += line.debit
      entry.totalCredit += line.credit
    } else {
      accountMap.set(acc.id, {
        name: acc.name,
        type: acc.type,
        currentBalance: acc.balance,
        totalDebit: line.debit,
        totalCredit: line.credit,
      })
    }
  }

  // Calculate net profit: income credit-normal minus expense debit-normal
  let totalIncomeNet = 0
  let totalExpenseNet = 0

  for (const [, v] of accountMap.entries()) {
    if (v.type === 'INCOME') {
      totalIncomeNet += v.totalCredit - v.totalDebit
    } else if (v.type === 'EXPENSE') {
      totalExpenseNet += v.totalDebit - v.totalCredit
    }
  }

  const netProfit = totalIncomeNet - totalExpenseNet

  // Resolve the Retained Earnings ledger account by its stable seeded code
  // (3100). seedDefaultAccounts assigns it subType null — filtering on
  // subType:'CAPITAL' here matched nothing and broke closure on every seeded
  // business (see .claude/fix-trace-fy-closure-re.md).
  const retainedEarningsAccount = await prisma.ledgerAccount.findFirst({
    where: {
      businessId,
      type: 'EQUITY',
      code: '3100',
    },
    select: { id: true, name: true, balance: true },
  })
  if (!retainedEarningsAccount) {
    throw validationError(
      'Retained Earnings account not found. Please create an EQUITY account named "Retained Earnings" before closing the FY.',
    )
  }

  const entryNumber = await buildClosureEntryNumber(businessId, financialYear)

  return prisma.$transaction(async (tx) => {
    const entryLines: EntryLineInput[] = []
    // Parallel balance-mutation lines (with account type) for the single writer.
    const balanceLines: BalanceLine[] = []
    let sortOrder = 0

    // Emit a closing line for EVERY income/expense account with a non-zero net,
    // regardless of sign. An INCOME account with a net debit (sales-returns /
    // contra-income) or an EXPENSE account with a net credit (refund) MUST get a
    // line too — otherwise its balance is never driven to 0 and the account is
    // stranded non-flat after close. balanceDelta over each line zeroes the
    // account derivably, which is why the old blanket set-0 is now removed.
    for (const [accountId, v] of accountMap.entries()) {
      let debit = 0
      let credit = 0
      if (v.type === 'INCOME') {
        const netIncome = v.totalCredit - v.totalDebit
        if (netIncome === 0) continue
        if (netIncome > 0) debit = netIncome
        else credit = -netIncome
      } else if (v.type === 'EXPENSE') {
        const netExpense = v.totalDebit - v.totalCredit
        if (netExpense === 0) continue
        if (netExpense > 0) credit = netExpense
        else debit = -netExpense
      } else {
        continue
      }
      entryLines.push({
        accountId,
        debit,
        credit,
        narration: `Closing entry — ${v.name}`,
        sortOrder: sortOrder++,
      })
      balanceLines.push({ accountId, accountType: v.type, debit, credit })
    }

    // Transfer net profit/loss to Retained Earnings
    if (netProfit !== 0) {
      const reDebit = netProfit < 0 ? Math.abs(netProfit) : 0
      const reCredit = netProfit > 0 ? netProfit : 0
      entryLines.push({
        accountId: retainedEarningsAccount.id,
        debit: reDebit,
        credit: reCredit,
        narration: netProfit > 0
          ? 'Net profit transferred to Retained Earnings'
          : 'Net loss transferred to Retained Earnings',
        sortOrder: sortOrder++,
      })
      balanceLines.push({
        accountId: retainedEarningsAccount.id,
        accountType: 'EQUITY',
        debit: reDebit,
        credit: reCredit,
      })
    }

    const totalDebit = entryLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = entryLines.reduce((s, l) => s + l.credit, 0)

    // Create the closing journal entry
    const journalEntry = await tx.journalEntry.create({
      data: {
        businessId,
        entryNumber,
        date: to,
        narration: `FY ${financialYear} closing entry`,
        type: 'FY_CLOSURE',
        status: 'POSTED',
        sourceType: 'FY_CLOSURE',
        totalDebit,
        totalCredit,
        createdBy: userId,
        postedAt: new Date(),
        lines: { create: entryLines },
      },
      select: { id: true },
    })

    // Apply the closing entry's own lines through the single balance writer.
    // Each income/expense line drives its account to 0; the RE line moves
    // Retained Earnings by netProfit. No separate set-0 / RE-increment — the
    // balances stay a pure function of the POSTED journal lines (SSOT).
    await postLedgerDeltas(tx, balanceLines)

    // Upsert FinancialYearClosure record
    const closureRecord = await tx.financialYearClosure.upsert({
      where: { businessId_financialYear: { businessId, financialYear } },
      create: {
        businessId,
        financialYear,
        closedAt: new Date(),
        closedBy: userId,
        retainedEarnings: netProfit,
        journalEntryId: journalEntry.id,
        status: 'CLOSED',
      },
      update: {
        closedAt: new Date(),
        closedBy: userId,
        retainedEarnings: netProfit,
        journalEntryId: journalEntry.id,
        status: 'CLOSED',
      },
    })

    return {
      closure: closureRecord,
      journalEntryId: journalEntry.id,
      entryNumber,
      netProfit,
      totalIncome: totalIncomeNet,
      totalExpenses: totalExpenseNet,
      accountsReset: accountMap.size,
    }
  })
}
