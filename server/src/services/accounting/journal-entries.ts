/**
 * Journal Entries — create, post, void, get, list.
 *
 * Key invariants:
 *   - Every posted entry: total debit === total credit
 *   - Balance mutations only happen on post and void
 *   - All balance mutations use $transaction for atomicity
 *   - Entry numbers are FY-scoped: "JE-2526-001"
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { getFySuffix, balanceDelta } from './helpers.js'
import type {
  CreateJournalEntryInput,
  ListJournalEntriesQuery,
} from '../../schemas/accounting.schemas.js'

// ─── Entry Number ──────────────────────────────────────────────────────────────

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createJournalEntry(
  businessId: string,
  userId: string,
  data: CreateJournalEntryInput,
) {
  const accountIds = [...new Set(data.lines.map((l) => l.accountId))]
  const accounts = await prisma.ledgerAccount.findMany({
    where: { id: { in: accountIds }, businessId, isActive: true },
    select: { id: true },
  })
  if (accounts.length !== accountIds.length) {
    throw validationError('One or more account IDs are invalid or inactive for this business')
  }

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
