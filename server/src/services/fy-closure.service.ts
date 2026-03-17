/**
 * Financial Year Closure Service
 *
 * Closing a financial year involves:
 *   1. Validating no duplicate closure for the same FY
 *   2. Calculating net P&L (income - expense) for the FY period (April 1 – March 31)
 *   3. Creating a closing journal entry: debit all income accounts, credit all expense accounts,
 *      difference goes to Retained Earnings (EQUITY)
 *   4. Resetting income/expense account balances to zero
 *   5. Persisting a FinancialYearClosure record
 *   All steps are wrapped in a Prisma $transaction.
 *
 * Financial year format: "2526" = April 2025 – March 2026
 */

import { prisma } from '../lib/prisma.js'
import { validationError, notFoundError } from '../lib/errors.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a 4-digit FY string like "2526" into start (April 1 2025) and end (March 31 2026) */
function fyDateRange(financialYear: string): { from: Date; to: Date } {
  if (!/^\d{4}$/.test(financialYear)) {
    throw validationError('financialYear must be a 4-digit string like "2526"')
  }

  const startYear = 2000 + parseInt(financialYear.slice(0, 2), 10)
  const endYear = 2000 + parseInt(financialYear.slice(2, 4), 10)

  if (endYear !== startYear + 1) {
    throw validationError('financialYear end year must be start year + 1 (e.g. "2526" = 2025-2026)')
  }

  // India FY: April 1 (start) → March 31 (end)
  const from = new Date(Date.UTC(startYear, 3, 1)) // April 1
  const to = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)) // March 31 EOD

  return { from, to }
}

/** Build a unique journal entry number for FY closure */
async function buildClosureEntryNumber(businessId: string, financialYear: string): Promise<string> {
  const count = await prisma.journalEntry.count({
    where: { businessId, type: 'FY_CLOSURE' },
  })
  return `FYCLOSE-${financialYear}-${String(count + 1).padStart(3, '0')}`
}

// ─── Close FY ─────────────────────────────────────────────────────────────────

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
  const accountMap = new Map<
    string,
    { name: string; type: string; currentBalance: number; totalDebit: number; totalCredit: number }
  >()

  for (const line of lines) {
    const acc = line.account
    const existing = accountMap.get(acc.id)
    if (existing) {
      existing.totalDebit += line.debit
      existing.totalCredit += line.credit
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
  // It must exist (system-created) under EQUITY. If missing we fail with a clear message.
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
    // Build closing journal entry lines
    // Closing = reverse all income/expense balances to zero them out
    // Income accounts (credit-normal): debit to zero out
    // Expense accounts (debit-normal): credit to zero out
    // Net goes to Retained Earnings
    type EntryLineInput = {
      accountId: string
      debit: number
      credit: number
      narration: string
      sortOrder: number
    }

    const entryLines: EntryLineInput[] = []
    let sortOrder = 0

    for (const [accountId, v] of accountMap.entries()) {
      if (v.type === 'INCOME') {
        const netIncome = v.totalCredit - v.totalDebit
        if (netIncome > 0) {
          // Debit income account to zero it
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
          // Credit expense account to zero it
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
    // Profit: credit Retained Earnings; Loss: debit Retained Earnings
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
        lines: {
          create: entryLines,
        },
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

// ─── List Closures ────────────────────────────────────────────────────────────

export async function getFYClosures(businessId: string) {
  return prisma.financialYearClosure.findMany({
    where: { businessId },
    orderBy: { financialYear: 'desc' },
  })
}

// ─── Reopen FY ────────────────────────────────────────────────────────────────

export async function reopenFY(businessId: string, financialYear: string) {
  const closure = await prisma.financialYearClosure.findUnique({
    where: { businessId_financialYear: { businessId, financialYear } },
    select: { id: true, status: true, journalEntryId: true, retainedEarnings: true },
  })
  if (!closure) throw notFoundError(`Financial year closure for ${financialYear}`)
  if (closure.status !== 'CLOSED') {
    throw validationError(`Financial year ${financialYear} is not in CLOSED status`)
  }

  return prisma.$transaction(async (tx) => {
    // Void the closing journal entry
    if (closure.journalEntryId) {
      const closingEntry = await tx.journalEntry.findUnique({
        where: { id: closure.journalEntryId },
        select: {
          id: true,
          status: true,
          lines: {
            select: {
              accountId: true,
              debit: true,
              credit: true,
              account: { select: { type: true } },
            },
          },
        },
      })

      if (closingEntry && closingEntry.status === 'POSTED') {
        // Reverse balance changes: undo the balance resets and RE adjustments
        for (const line of closingEntry.lines) {
          // Reverse: credit became debit → was zeroing income (income had credit net)
          // Reversing: subtract debit (which was the closing debit) from the account balance
          // For income/expense accounts: restore their balance
          // For retained earnings: reverse the RE adjustment
          if (line.account.type === 'INCOME') {
            // Was debited to close — restore by crediting back (increase balance)
            await tx.ledgerAccount.update({
              where: { id: line.accountId },
              data: { balance: { increment: line.debit } },
            })
          } else if (line.account.type === 'EXPENSE') {
            // Was credited to close — restore by debiting back (increase balance)
            await tx.ledgerAccount.update({
              where: { id: line.accountId },
              data: { balance: { increment: line.credit } },
            })
          } else if (line.account.type === 'EQUITY') {
            // Retained earnings: reverse the credit/debit
            const delta = line.credit - line.debit
            await tx.ledgerAccount.update({
              where: { id: line.accountId },
              data: { balance: { decrement: delta } },
            })
          }
        }

        // Void the entry
        await tx.journalEntry.update({
          where: { id: closure.journalEntryId },
          data: {
            status: 'VOID',
            voidedAt: new Date(),
            voidedBy: 'system',
            voidReason: `FY ${financialYear} reopened`,
          },
        })
      }
    }

    // Mark closure as reopened
    return tx.financialYearClosure.update({
      where: { id: closure.id },
      data: { status: 'REOPENED' },
    })
  })
}
