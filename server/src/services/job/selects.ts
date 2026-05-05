/**
 * Job Service — Prisma select objects for list and detail queries
 */

export const JOB_LIST_SELECT = {
  id: true,
  jobNumber: true,
  title: true,
  status: true,
  partyId: true,
  scheduledAt: true,
  totalPaise: true,
  invoiceId: true,
  updatedAt: true,
  party: {
    select: { id: true, name: true, phone: true },
  },
} as const

export const JOB_DETAIL_SELECT = {
  id: true,
  jobNumber: true,
  title: true,
  status: true,
  partyId: true,
  scheduledAt: true,
  totalPaise: true,
  invoiceId: true,
  updatedAt: true,
  description: true,
  subtotalPaise: true,
  discountPaise: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  clientId: true,
  createdAt: true,
  createdBy: true,
  updatedBy: true,
  isDeleted: true,
  deletedAt: true,
  party: {
    select: { id: true, name: true, phone: true },
  },
  items: {
    select: {
      id: true,
      sortOrder: true,
      productId: true,
      description: true,
      quantity: true,
      ratePaise: true,
      discountPaise: true,
      totalPaise: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const
