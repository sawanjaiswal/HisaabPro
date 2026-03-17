/**
 * Loan Service — Create and manage loan accounts (LOAN_GIVEN / LOAN_TAKEN).
 *
 * All monetary amounts are in PAISE (integer).
 * outstandingAmount tracks the remaining principal owed.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError } from '../lib/errors.js'
import type { CreateLoanInput, ListLoansQuery, RecordLoanTransactionInput } from '../schemas/loan.schemas.js'

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createLoanAccount(
  businessId: string,
  userId: string,
  data: CreateLoanInput,
) {
  if (data.endDate && data.endDate <= data.startDate) {
    throw validationError('endDate must be after startDate')
  }

  if (data.partyId) {
    const party = await prisma.party.findFirst({
      where: { id: data.partyId, businessId, isActive: true },
      select: { id: true },
    })
    if (!party) {
      throw validationError('Party not found or does not belong to this business')
    }
  }

  return prisma.loanAccount.create({
    data: {
      businessId,
      type: data.type,
      partyId: data.partyId ?? null,
      loanName: data.loanName,
      principalAmount: data.principalAmount,
      outstandingAmount: data.principalAmount, // starts at full principal
      interestRate: data.interestRate ?? 0,
      tenure: data.tenure ?? null,
      emiAmount: data.emiAmount ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      notes: data.notes ?? null,
      status: 'ACTIVE',
      createdBy: userId,
    },
  })
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getLoanAccount(businessId: string, loanId: string) {
  const loan = await prisma.loanAccount.findFirst({
    where: { id: loanId, businessId },
    include: {
      transactions: {
        orderBy: { date: 'asc' },
      },
    },
  })
  if (!loan) throw notFoundError('Loan account')
  return loan
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listLoanAccounts(businessId: string, query: ListLoansQuery) {
  const { type, status, page, limit } = query
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(type && { type }),
    ...(status && { status }),
  }

  const [items, total] = await Promise.all([
    prisma.loanAccount.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { transactions: true } },
      },
    }),
    prisma.loanAccount.count({ where }),
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

// ─── Record Transaction ───────────────────────────────────────────────────────

export async function recordLoanTransaction(
  businessId: string,
  loanId: string,
  data: RecordLoanTransactionInput,
) {
  const loan = await prisma.loanAccount.findFirst({
    where: { id: loanId, businessId },
    select: {
      id: true,
      status: true,
      outstandingAmount: true,
      totalInterestPaid: true,
      principalAmount: true,
    },
  })
  if (!loan) throw notFoundError('Loan account')

  if (loan.status === 'CLOSED') {
    throw validationError('Cannot record a transaction on a closed loan')
  }

  const principalPortion = data.principalAmount ?? 0
  const interestPortion = data.interestAmount ?? 0

  // Validate: principal reduction cannot exceed outstanding
  if (
    (data.type === 'EMI' || data.type === 'PREPAYMENT' || data.type === 'CLOSURE') &&
    principalPortion > loan.outstandingAmount
  ) {
    throw validationError(
      `Principal portion (${principalPortion}) exceeds outstanding amount (${loan.outstandingAmount})`,
    )
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.loanTransaction.create({
      data: {
        loanAccountId: loanId,
        type: data.type,
        amount: data.amount,
        principalAmount: principalPortion,
        interestAmount: interestPortion,
        date: data.date,
        notes: data.notes ?? null,
      },
    })

    // Update loan balances
    const newOutstanding = loan.outstandingAmount - principalPortion
    const newInterestPaid = loan.totalInterestPaid + interestPortion
    const isClosure = data.type === 'CLOSURE'

    await tx.loanAccount.update({
      where: { id: loanId },
      data: {
        outstandingAmount: newOutstanding,
        totalInterestPaid: newInterestPaid,
        ...(isClosure && { status: 'CLOSED', outstandingAmount: 0 }),
      },
    })

    return transaction
  })
}

// ─── Statement ────────────────────────────────────────────────────────────────

export async function getLoanStatement(businessId: string, loanId: string) {
  const loan = await prisma.loanAccount.findFirst({
    where: { id: loanId, businessId },
    select: {
      id: true,
      loanName: true,
      type: true,
      principalAmount: true,
      outstandingAmount: true,
      interestRate: true,
      totalInterestPaid: true,
      status: true,
      startDate: true,
      endDate: true,
      transactions: {
        orderBy: { date: 'asc' },
      },
    },
  })
  if (!loan) throw notFoundError('Loan account')

  // Build running balance
  let runningBalance = loan.principalAmount
  const statement = loan.transactions.map((txn) => {
    runningBalance -= txn.principalAmount
    return {
      ...txn,
      runningBalance,
    }
  })

  return {
    loan: {
      id: loan.id,
      loanName: loan.loanName,
      type: loan.type,
      principalAmount: loan.principalAmount,
      outstandingAmount: loan.outstandingAmount,
      interestRate: loan.interestRate,
      totalInterestPaid: loan.totalInterestPaid,
      status: loan.status,
      startDate: loan.startDate,
      endDate: loan.endDate,
    },
    transactions: statement,
  }
}

// ─── Close ────────────────────────────────────────────────────────────────────

export async function closeLoan(businessId: string, loanId: string) {
  const loan = await prisma.loanAccount.findFirst({
    where: { id: loanId, businessId },
    select: { id: true, status: true },
  })
  if (!loan) throw notFoundError('Loan account')
  if (loan.status === 'CLOSED') {
    throw validationError('Loan is already closed')
  }

  return prisma.loanAccount.update({
    where: { id: loanId },
    data: { status: 'CLOSED', outstandingAmount: 0 },
  })
}
