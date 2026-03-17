/**
 * Accounting Service — Core double-entry accounting for HisaabPro.
 *
 * Key invariants enforced here:
 *   - Every posted journal entry: total debit === total credit
 *   - Balance rules: ASSET/EXPENSE are debit-normal; LIABILITY/EQUITY/INCOME are credit-normal
 *   - Balance mutations only happen on post and void (not on draft create)
 *   - All balance mutations use $transaction for atomicity
 *   - Entry numbers are FY-scoped: "JE-2526-001" (April 2025–March 2026 = "2526")
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../lib/errors.js'
import type {
  CreateJournalEntryInput,
  ListJournalEntriesQuery,
  CreateLedgerAccountInput,
  UpdateLedgerAccountInput,
  ListLedgerAccountsQuery,
} from '../schemas/accounting.schemas.js'

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Account types where debit increases balance (debit-normal accounts). */
const DEBIT_NORMAL_TYPES = new Set(['ASSET', 'EXPENSE'])

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the Indian FY suffix for a given date.
 * April 2025 – March 2026 → "2526"
 */
function getFySuffix(date: Date): string {
  const month = date.getMonth() // 0-based; April = 3
  const year = date.getFullYear()
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`
}

/**
 * Calculate the net balance delta for a single line on a given account type.
 * Returns a positive number to increment, negative to decrement.
 */
function balanceDelta(accountType: string, debit: number, credit: number): number {
  if (DEBIT_NORMAL_TYPES.has(accountType)) {
    return debit - credit
  }
  return credit - debit
}

// ─── Chart of Accounts ─────────────────────────────────────────────────────────

/**
 * Seeds the default chart of accounts for a business.
 * Idempotent — uses skipDuplicates on the @@unique([businessId, code]) constraint.
 */
export async function seedDefaultAccounts(businessId: string) {
  const defaults = [
    { code: '1000', name: 'Cash in Hand',       type: 'ASSET',     subType: 'CASH',             isSystem: true },
    { code: '1100', name: 'Bank Accounts',       type: 'ASSET',     subType: 'BANK',             isSystem: true },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET',     subType: 'RECEIVABLE',       isSystem: true },
    { code: '1300', name: 'Inventory',           type: 'ASSET',     subType: 'INVENTORY',        isSystem: true },
    { code: '2000', name: 'Accounts Payable',    type: 'LIABILITY', subType: 'PAYABLE',          isSystem: true },
    { code: '2100', name: 'Tax Payable',         type: 'LIABILITY', subType: 'TAX',              isSystem: true },
    { code: '2200', name: 'TDS Payable',         type: 'LIABILITY', subType: 'TAX',              isSystem: true },
    { code: '3000', name: 'Capital Account',     type: 'EQUITY',    subType: 'CAPITAL',          isSystem: true },
    { code: '3100', name: 'Retained Earnings',   type: 'EQUITY',    subType: null,               isSystem: true },
    { code: '4000', name: 'Sales Revenue',       type: 'INCOME',    subType: 'REVENUE',          isSystem: true },
    { code: '4100', name: 'Other Income',        type: 'INCOME',    subType: null,               isSystem: true },
    { code: '5000', name: 'Purchases',           type: 'EXPENSE',   subType: 'PURCHASE',         isSystem: true },
    { code: '5100', name: 'Direct Expenses',     type: 'EXPENSE',   subType: 'DIRECT_EXPENSE',   isSystem: true },
    { code: '5200', name: 'Indirect Expenses',   type: 'EXPENSE',   subType: 'INDIRECT_EXPENSE', isSystem: true },
    { code: '5300', name: 'Tax Expense',         type: 'EXPENSE',   subType: 'TAX',              isSystem: true },
  ]

  await prisma.ledgerAccount.createMany({
    data: defaults.map((a) => ({
      businessId,
      code: a.code,
      name: a.name,
      type: a.type,
      subType: a.subType ?? undefined,
      isSystem: a.isSystem,
      isActive: true,
      balance: 0,
    })),
    skipDuplicates: true,
  })

  return { seeded: true, accounts: defaults.length }
}

// ─── Ledger Account CRUD ───────────────────────────────────────────────────────

export async function createLedgerAccount(businessId: string, data: CreateLedgerAccountInput) {
  // Validate parent exists and belongs to this business if provided
  if (data.parentId) {
    const parent = await prisma.ledgerAccount.findFirst({
      where: { id: data.parentId, businessId },
      select: { id: true },
    })
    if (!parent) throw validationError('Parent account not found in this business')
  }

  // Check for duplicate code within this business
  const existing = await prisma.ledgerAccount.findFirst({
    where: { businessId, code: data.code },
    select: { id: true },
  })
  if (existing) throw conflictError(`Account with code "${data.code}" already exists`)

  return prisma.ledgerAccount.create({
    data: {
      businessId,
      code: data.code,
      name: data.name,
      type: data.type,
      subType: data.subType ?? null,
      parentId: data.parentId ?? null,
      description: data.description ?? null,
      isSystem: false,
      isActive: true,
      balance: 0,
    },
  })
}

export async function updateLedgerAccount(
  businessId: string,
  accountId: string,
  data: UpdateLedgerAccountInput,
) {
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, businessId },
    select: { id: true, isSystem: true, type: true },
  })
  if (!account) throw notFoundError('Ledger account')

  // System accounts cannot have their type changed
  if (account.isSystem && data.type && data.type !== account.type) {
    throw validationError('Cannot change the type of a system account')
  }

  // Validate new parent if provided
  if (data.parentId) {
    if (data.parentId === accountId) throw validationError('An account cannot be its own parent')
    const parent = await prisma.ledgerAccount.findFirst({
      where: { id: data.parentId, businessId },
      select: { id: true },
    })
    if (!parent) throw validationError('Parent account not found in this business')
  }

  // Check for duplicate code if code is being changed
  if (data.code) {
    const duplicate = await prisma.ledgerAccount.findFirst({
      where: { businessId, code: data.code, id: { not: accountId } },
      select: { id: true },
    })
    if (duplicate) throw conflictError(`Account with code "${data.code}" already exists`)
  }

  return prisma.ledgerAccount.update({
    where: { id: accountId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.subType !== undefined && { subType: data.subType }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })
}

export async function listLedgerAccounts(businessId: string, query: ListLedgerAccountsQuery) {
  const { type, subType, isActive, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(type && { type }),
    ...(subType && { subType }),
    ...(isActive !== undefined && { isActive }),
  }

  const [items, total] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        subType: true,
        parentId: true,
        description: true,
        isSystem: true,
        isActive: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.ledgerAccount.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getLedgerAccount(businessId: string, accountId: string) {
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, businessId },
    include: {
      children: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          subType: true,
          isActive: true,
          balance: true,
        },
        orderBy: { code: 'asc' },
      },
    },
  })
  if (!account) throw notFoundError('Ledger account')
  return account
}

// ─── Journal Entry Number ───────────────────────────────────────────────────────

/**
 * Generates the next journal entry number in the format "JE-2526-NNN".
 * Counts existing entries for the same business + FY prefix.
 */
export async function generateEntryNumber(businessId: string, date: Date): Promise<string> {
  const fySuffix = getFySuffix(date)
  const prefix = `JE-${fySuffix}-`

  const count = await prisma.journalEntry.count({
    where: {
      businessId,
      entryNumber: { startsWith: prefix },
    },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `${prefix}${seq}`
}

// ─── Journal Entry CRUD ────────────────────────────────────────────────────────

export async function createJournalEntry(
  businessId: string,
  userId: string,
  data: CreateJournalEntryInput,
) {
  // Validate all accountIds exist for this business
  const accountIds = [...new Set(data.lines.map((l) => l.accountId))]
  const accounts = await prisma.ledgerAccount.findMany({
    where: { id: { in: accountIds }, businessId, isActive: true },
    select: { id: true },
  })
  if (accounts.length !== accountIds.length) {
    throw validationError('One or more account IDs are invalid or inactive for this business')
  }

  // Validate totals (schema already checks this, but double-check at service layer)
  const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)
  if (totalDebit !== totalCredit) {
    throw validationError('Total debits must equal total credits')
  }

  const entryNumber = await generateEntryNumber(businessId, data.date)

  return prisma.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      date: data.date,
      narration: data.narration ?? null,
      type: data.type,
      status: 'DRAFT',
      totalDebit,
      totalCredit,
      createdBy: userId,
      lines: {
        create: data.lines.map((line, idx) => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          narration: line.narration ?? null,
          partyId: line.partyId ?? null,
          sortOrder: idx,
        })),
      },
    },
    include: {
      lines: {
        include: { account: { select: { id: true, code: true, name: true, type: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

export async function postJournalEntry(businessId: string, entryId: string) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, businessId },
    include: {
      lines: {
        include: { account: { select: { id: true, type: true } } },
      },
    },
  })
  if (!entry) throw notFoundError('Journal entry')
  if (entry.status === 'POSTED') throw validationError('Entry is already posted')
  if (entry.status === 'VOID') throw validationError('Cannot post a voided entry')

  return prisma.$transaction(async (tx) => {
    // Update each account's running balance
    for (const line of entry.lines) {
      const delta = balanceDelta(line.account.type, line.debit, line.credit)
      if (delta !== 0) {
        await tx.ledgerAccount.update({
          where: { id: line.accountId },
          data: { balance: { increment: delta } },
        })
      }
    }

    return tx.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
      },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
  })
}

export async function voidJournalEntry(
  businessId: string,
  entryId: string,
  userId: string,
  reason: string,
) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, businessId },
    include: {
      lines: {
        include: { account: { select: { id: true, type: true } } },
      },
    },
  })
  if (!entry) throw notFoundError('Journal entry')
  if (entry.status === 'VOID') throw validationError('Entry is already voided')
  if (entry.status === 'DRAFT') {
    // Draft entries have no balance impact — void directly without reversals
    return prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      },
    })
  }

  // Posted entry — reverse all balance updates inside a transaction
  return prisma.$transaction(async (tx) => {
    for (const line of entry.lines) {
      const delta = balanceDelta(line.account.type, line.debit, line.credit)
      if (delta !== 0) {
        await tx.ledgerAccount.update({
          where: { id: line.accountId },
          data: { balance: { increment: -delta } },
        })
      }
    }

    return tx.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason,
      },
    })
  })
}

export async function getJournalEntry(businessId: string, entryId: string) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, businessId },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true, subType: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!entry) throw notFoundError('Journal entry')
  return entry
}

export async function listJournalEntries(businessId: string, query: ListJournalEntriesQuery) {
  const { from, to, type, status, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(type && { type }),
    ...(status && { status }),
    ...(from || to
      ? {
          date: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { entryNumber: 'desc' }],
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    prisma.journalEntry.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ─── Reports ───────────────────────────────────────────────────────────────────

/**
 * Trial Balance — all accounts with cumulative debit/credit totals from POSTED lines.
 * If asOf is provided, only lines from entries dated <= asOf are included.
 * The sum of all debit totals must equal sum of all credit totals (double-entry check).
 */
export async function getTrialBalance(businessId: string, asOf?: Date) {
  const dateFilter = asOf ? { date: { lte: asOf } } : {}

  // Get all accounts for this business
  const accounts = await prisma.ledgerAccount.findMany({
    where: { businessId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subType: true,
      journalLines: {
        where: {
          journalEntry: {
            businessId,
            status: 'POSTED',
            ...dateFilter,
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  let grandTotalDebit = 0
  let grandTotalCredit = 0

  const rows = accounts.map((account) => {
    const totalDebit = account.journalLines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = account.journalLines.reduce((sum, l) => sum + l.credit, 0)
    grandTotalDebit += totalDebit
    grandTotalCredit += totalCredit

    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType,
      totalDebit,
      totalCredit,
      // Net balance for display convenience (positive = debit-side for ASSET/EXPENSE)
      netBalance: DEBIT_NORMAL_TYPES.has(account.type)
        ? totalDebit - totalCredit
        : totalCredit - totalDebit,
    }
  })

  return {
    asOf: asOf ?? null,
    rows,
    grandTotalDebit,
    grandTotalCredit,
    isBalanced: grandTotalDebit === grandTotalCredit,
  }
}

/**
 * Ledger Report — all POSTED journal lines for a single account, with running balance.
 */
export async function getLedgerReport(
  businessId: string,
  accountId: string,
  from?: Date,
  to?: Date,
) {
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, businessId },
    select: { id: true, code: true, name: true, type: true, subType: true, balance: true },
  })
  if (!account) throw notFoundError('Ledger account')

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        businessId,
        status: 'POSTED',
        ...(from || to
          ? {
              date: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
    },
    include: {
      journalEntry: {
        select: { id: true, entryNumber: true, date: true, narration: true, type: true },
      },
    },
    orderBy: [{ journalEntry: { date: 'asc' } }, { journalEntry: { entryNumber: 'asc' } }],
  })

  // Build running balance (forward from zero for the filtered period)
  let runningBalance = 0
  const entries = lines.map((line) => {
    const delta = balanceDelta(account.type, line.debit, line.credit)
    runningBalance += delta
    return {
      lineId: line.id,
      entryId: line.journalEntry.id,
      entryNumber: line.journalEntry.entryNumber,
      date: line.journalEntry.date,
      type: line.journalEntry.type,
      narration: line.narration ?? line.journalEntry.narration,
      debit: line.debit,
      credit: line.credit,
      runningBalance,
    }
  })

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType,
      currentBalance: account.balance,
    },
    from: from ?? null,
    to: to ?? null,
    entries,
    totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
    totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
  }
}

/**
 * Day Book — all journal entries (with full lines) for a given date.
 */
export async function getDayBook(businessId: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const entries = await prisma.journalEntry.findMany({
    where: {
      businessId,
      status: 'POSTED',
      date: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { entryNumber: 'asc' },
  })

  const totalDebit = entries.reduce((sum, e) => sum + e.totalDebit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.totalCredit, 0)

  return {
    date: startOfDay,
    entries,
    totalDebit,
    totalCredit,
    entryCount: entries.length,
  }
}
