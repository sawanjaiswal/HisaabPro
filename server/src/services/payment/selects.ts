/**
 * Payment select constants — shared across all payment sub-modules
 */

export const PAYMENT_LIST_SELECT = {
  id: true,
  type: true,
  amount: true,
  date: true,
  mode: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  party: { select: { id: true, name: true, phone: true } },
  _count: { select: { allocations: true } },
  discount: { select: { calculatedAmount: true } },
} as const

export const PAYMENT_DETAIL_SELECT = {
  id: true,
  offlineId: true,
  type: true,
  amount: true,
  date: true,
  mode: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: {
      id: true, name: true, phone: true,
      outstandingBalance: true,
    },
  },
  allocations: {
    select: {
      id: true,
      amount: true,
      invoice: {
        select: { id: true, documentNumber: true, grandTotal: true, balanceDue: true },
      },
    },
  },
  discount: {
    select: {
      id: true, type: true, value: true,
      calculatedAmount: true, reason: true,
    },
  },
  creator: { select: { id: true, name: true } },
} as const
