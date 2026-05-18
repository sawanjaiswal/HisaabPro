/**
 * Recurring CRUD — audit-write smoke (PR7 backfill).
 *
 * Asserts createRecurring / updateRecurring / deleteRecurring each write
 * ONE RecurringDocument audit row inside their tx, with userId set from
 * the route layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRecurring, updateRecurring, deleteRecurring } from '../crud.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../dates.js', () => ({
  calculateNextRunDate: vi.fn().mockReturnValue(new Date('2026-06-01')),
  initialNextRunDate: vi.fn().mockReturnValue(new Date('2026-06-01')),
}))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const RECURRING_ID = 'rec-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createRecurring — audit', () => {
  it('writes one RecurringDocument CREATE audit row with userId', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({
      id: 'doc-template',
      partyId: 'party-1',
      type: 'SALE_INVOICE',
    })
    mockPrisma.recurringInvoice.create.mockResolvedValue({ id: RECURRING_ID })

    await createRecurring(BUSINESS_ID, USER_ID, {
      templateDocumentId: 'doc-template',
      frequency: 'MONTHLY',
      startDate: new Date('2026-06-01'),
      autoSend: false,
      autoPaymentLink: false,
      autoReminder: false,
    })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'RecurringDocument',
        entityId: RECURRING_ID,
        userId: USER_ID,
        action: 'CREATE',
      }),
    })
  })
})

describe('updateRecurring — audit', () => {
  it('writes one RecurringDocument UPDATE audit row with userId', async () => {
    mockPrisma.recurringInvoice.findFirst.mockResolvedValue({
      id: RECURRING_ID,
      status: 'ACTIVE',
      frequency: 'MONTHLY',
      nextRunDate: new Date('2026-06-01'),
      dayOfMonth: 1,
      dayOfWeek: null,
    })
    mockPrisma.recurringInvoice.update.mockResolvedValue({ id: RECURRING_ID })

    await updateRecurring(BUSINESS_ID, RECURRING_ID, USER_ID, { autoSend: true })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'RecurringDocument',
        entityId: RECURRING_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})

describe('deleteRecurring — audit', () => {
  it('writes one RecurringDocument DELETE audit row with userId (hard delete)', async () => {
    mockPrisma.recurringInvoice.findFirst.mockResolvedValue({
      id: RECURRING_ID,
      generatedCount: 0,
    })
    mockPrisma.recurringInvoice.delete.mockResolvedValue({ id: RECURRING_ID })

    await deleteRecurring(BUSINESS_ID, RECURRING_ID, USER_ID)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'RecurringDocument',
        entityId: RECURRING_ID,
        userId: USER_ID,
        action: 'DELETE',
      }),
    })
  })

  it('writes one RecurringDocument DELETE audit row with userId (soft complete)', async () => {
    mockPrisma.recurringInvoice.findFirst.mockResolvedValue({
      id: RECURRING_ID,
      generatedCount: 3,
    })
    mockPrisma.recurringInvoice.update.mockResolvedValue({ id: RECURRING_ID })

    await deleteRecurring(BUSINESS_ID, RECURRING_ID, USER_ID)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'RecurringDocument',
        entityId: RECURRING_ID,
        userId: USER_ID,
        action: 'DELETE',
      }),
    })
  })
})
