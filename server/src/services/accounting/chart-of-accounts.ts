/**
 * Chart of Accounts — ledger account CRUD and seeding.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../../lib/errors.js'
import type {
  CreateLedgerAccountInput,
  UpdateLedgerAccountInput,
  ListLedgerAccountsQuery,
} from '../../schemas/accounting.schemas.js'

// ─── Seed ──────────────────────────────────────────────────────────────────────

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createLedgerAccount(businessId: string, data: CreateLedgerAccountInput) {
  if (data.parentId) {
    const parent = await prisma.ledgerAccount.findFirst({
      where: { id: data.parentId, businessId },
      select: { id: true },
    })
    if (!parent) throw validationError('Parent account not found in this business')
  }

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

  if (account.isSystem && data.type && data.type !== account.type) {
    throw validationError('Cannot change the type of a system account')
  }

  if (data.parentId) {
    if (data.parentId === accountId) throw validationError('An account cannot be its own parent')
    const parent = await prisma.ledgerAccount.findFirst({
      where: { id: data.parentId, businessId },
      select: { id: true },
    })
    if (!parent) throw validationError('Parent account not found in this business')
  }

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
