/** Prisma `select` shapes for loan reads — pinned to prevent over-fetch. */

export const loanTransactionSelect = {
  id: true,
  loanAccountId: true,
  type: true,
  amount: true,
  principalAmount: true,
  interestAmount: true,
  date: true,
  journalEntryId: true,
  notes: true,
  createdAt: true,
} as const

export const loanAccountWithTxSelect = {
  id: true,
  businessId: true,
  type: true,
  partyId: true,
  loanName: true,
  principalAmount: true,
  interestRate: true,
  tenure: true,
  emiAmount: true,
  startDate: true,
  endDate: true,
  outstandingAmount: true,
  totalInterestPaid: true,
  status: true,
  journalEntryId: true,
  notes: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  transactions: {
    orderBy: { date: 'asc' as const },
    select: loanTransactionSelect,
  },
} as const
