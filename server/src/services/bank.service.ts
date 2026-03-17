/**
 * Bank Account Service
 * Manages bank accounts for a business. First account auto-set as default.
 * Soft delete is blocked if cheques are linked to the account.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  ListBankAccountsQuery,
} from '../schemas/bank.schemas.js'

export async function createBankAccount(businessId: string, data: CreateBankAccountInput) {
  // Check for duplicate account number within this business
  const existing = await prisma.bankAccount.findFirst({
    where: { businessId, accountNumber: data.accountNumber },
    select: { id: true },
  })
  if (existing) {
    throw validationError('An account with this account number already exists')
  }

  // If this is the first account or isDefault requested, handle default logic
  const accountCount = await prisma.bankAccount.count({ where: { businessId } })
  const shouldBeDefault = accountCount === 0 ? true : data.isDefault

  // If marking new account as default, unset existing default
  if (shouldBeDefault) {
    await prisma.bankAccount.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.bankAccount.create({
    data: {
      businessId,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      ifscCode: data.ifscCode ?? null,
      branchName: data.branchName ?? null,
      accountType: data.accountType,
      openingBalance: data.openingBalance,
      currentBalance: data.openingBalance,
      isDefault: shouldBeDefault,
    },
  })
}

export async function updateBankAccount(
  businessId: string,
  accountId: string,
  data: UpdateBankAccountInput,
) {
  const existing = await prisma.bankAccount.findFirst({
    where: { id: accountId, businessId },
    select: { id: true, accountNumber: true, isDefault: true },
  })
  if (!existing) throw notFoundError('Bank account')

  // If account number changing, check for duplicate
  if (data.accountNumber && data.accountNumber !== existing.accountNumber) {
    const duplicate = await prisma.bankAccount.findFirst({
      where: { businessId, accountNumber: data.accountNumber, id: { not: accountId } },
      select: { id: true },
    })
    if (duplicate) throw validationError('An account with this account number already exists')
  }

  // If setting as default, unset existing default
  if (data.isDefault === true && !existing.isDefault) {
    await prisma.bankAccount.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      ...(data.bankName !== undefined && { bankName: data.bankName }),
      ...(data.accountNumber !== undefined && { accountNumber: data.accountNumber }),
      ...(data.ifscCode !== undefined && { ifscCode: data.ifscCode }),
      ...(data.branchName !== undefined && { branchName: data.branchName }),
      ...(data.accountType !== undefined && { accountType: data.accountType }),
      ...(data.openingBalance !== undefined && { openingBalance: data.openingBalance }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
  })
}

export async function listBankAccounts(businessId: string, query: ListBankAccountsQuery) {
  const { isActive, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(isActive !== undefined && { isActive }),
  }

  const [items, total] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        ifscCode: true,
        branchName: true,
        accountType: true,
        openingBalance: true,
        currentBalance: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.bankAccount.count({ where }),
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

export async function getBankAccount(businessId: string, accountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, businessId },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      ifscCode: true,
      branchName: true,
      accountType: true,
      openingBalance: true,
      currentBalance: true,
      isDefault: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { cheques: { where: { isDeleted: false } } },
      },
    },
  })
  if (!account) throw notFoundError('Bank account')
  return account
}

export async function deleteBankAccount(businessId: string, accountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, businessId },
    select: { id: true, isDefault: true, _count: { select: { cheques: { where: { isDeleted: false } } } } },
  })
  if (!account) throw notFoundError('Bank account')

  if (account._count.cheques > 0) {
    throw validationError('Cannot delete a bank account that has linked cheques')
  }

  if (account.isDefault) {
    throw validationError('Cannot delete the default bank account. Set another account as default first.')
  }

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  })

  return { deleted: true }
}
