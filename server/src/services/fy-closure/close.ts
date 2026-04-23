/**
 * Close FY — validates, builds closing journal entry, resets income/expense balances,
 * transfers net P&L to Retained Earnings, persists FinancialYearClosure record.
 */
import { prisma } from '../../lib/prisma.js'
import { validationError } from '../../lib/errors.js'
import { fyDateRange, buildClosureEntryNumber } from './helpers.js'

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

  // Find or identify the Retained Earnings ledger account
  const retainedEarningsAccount = await prisma.ledgerAccount.findFirst({
    where: {
      businessId,
      type: 'EQUITY',
      subType: 'CAPITAL',
      name: { contains: 'Retained Earnings' },
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
    let sortOrder = 0

    for (const [accountId, v] of accountMap.entries()) {
      if (v.type === 'INCOME') {
        const netIncome = v.totalCredit - v.totalDebit
        if (netIncome > 0) {
          entryLines.push({
            accountId,
            debit: netIncome,
            credit: 0,
            narration: `Closing entry — ${v.name}`,
            sortOrder: sortOrder++,
          })
        }
      } else if (v.type === 'EXPENSE') {
        const netExpense = v.totalDebit - v.totalCredit
        if (netExpense > 0) {
          entryLines.push({
            accountId,
            debit: 0,
            credit: netExpense,
            narration: `Closing entry — ${v.name}`,
            sortOrder: sortOrder++,
          })
        }
      }
    }

    // Transfer net profit/loss to Retained Earnings
    if (netProfit > 0) {
      entryLines.push({
        accountId: retainedEarningsAccount.id,
        debit: 0,
        credit: netProfit,
        narration: 'Net profit transferred to Retained Earnings',
        sortOrder: sortOrder++,
      })
    } else if (netProfit < 0) {
      entryLines.push({
        accountId: retainedEarningsAccount.id,
        debit: Math.abs(netProfit),
        credit: 0,
        narration: 'Net loss transferred to Retained Earnings',
        sortOrder: sortOrder++,
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

    // Reset income/expense account balances to zero
    const accountIdsToReset = Array.from(accountMap.keys())
    if (accountIdsToReset.length > 0) {
      await tx.ledgerAccount.updateMany({
        where: { id: { in: accountIdsToReset } },
        data: { balance: 0 },
      })
    }

    // Update Retained Earnings balance
    await tx.ledgerAccount.update({
      where: { id: retainedEarningsAccount.id },
      data: { balance: { increment: netProfit } },
    })

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
      accountsReset: accountIdsToReset.length,
    }
  })
}
