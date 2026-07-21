/**
 * Party detail stats + ledger row status.
 *
 * Two things the new single-customer template reads and nothing else covers:
 * the direction switch (a supplier must be read as purchases/payments-out, not
 * sales) and the oldest-overdue row that drives the alert banner. The pure
 * `documentLedgerStatus` classifier is tested directly — it decides which badge
 * every ledger row wears.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../../lib/prisma.js'
import { getPartyStats } from '../detail-stats.js'
import { documentLedgerStatus } from '../ledger.utils.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BIZ = 'biz-1'
const PARTY = 'party-1'
const DAY = 86_400_000

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.document.aggregate.mockResolvedValue({ _sum: { grandTotal: 0 }, _count: 0 })
  mockPrisma.document.findFirst.mockResolvedValue(null)
  mockPrisma.document.count.mockResolvedValue(0)
  mockPrisma.payment.findFirst.mockResolvedValue(null)
})

describe('getPartyStats — direction', () => {
  it('reads sale invoices and payments-in for a customer', async () => {
    await getPartyStats(BIZ, PARTY, 'CUSTOMER')
    expect(mockPrisma.document.count.mock.calls[0][0].where.type).toBe('SALE_INVOICE')
    expect(mockPrisma.payment.findFirst.mock.calls[0][0].where.type).toBe('PAYMENT_IN')
  })

  it('reads purchase invoices and payments-out for a supplier', async () => {
    await getPartyStats(BIZ, PARTY, 'SUPPLIER')
    expect(mockPrisma.document.count.mock.calls[0][0].where.type).toBe('PURCHASE_INVOICE')
    expect(mockPrisma.payment.findFirst.mock.calls[0][0].where.type).toBe('PAYMENT_OUT')
  })

  it('scopes every read to the business and party', async () => {
    await getPartyStats(BIZ, PARTY)
    const where = mockPrisma.document.count.mock.calls[0][0].where
    expect(where.businessId).toBe(BIZ)
    expect(where.partyId).toBe(PARTY)
  })
})

describe('getPartyStats — overdue banner', () => {
  it('is not overdue and names no invoice when nothing is past due', async () => {
    const stats = await getPartyStats(BIZ, PARTY)
    expect(stats.isOverdue).toBe(false)
    expect(stats.oldestDueDays).toBe(0)
    expect(stats.oldestOverdueInvoice).toBeNull()
  })

  it('reports the oldest owing invoice with whole days past due', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({
      id: 'doc-9',
      documentNumber: 'INV-1056',
      balanceDue: 250000,
      dueDate: new Date(Date.now() - 12 * DAY - 1000),
    })
    const stats = await getPartyStats(BIZ, PARTY)
    expect(stats.isOverdue).toBe(true)
    expect(stats.oldestDueDays).toBe(12)
    expect(stats.oldestOverdueInvoice).toEqual({
      id: 'doc-9',
      number: 'INV-1056',
      amountPaise: 250000, // balance still owing, NOT the grand total
      daysOverdue: 12,
    })
  })

  it('counts every still-owing invoice, overdue or not', async () => {
    mockPrisma.document.count.mockResolvedValue(4)
    const stats = await getPartyStats(BIZ, PARTY)
    expect(stats.openInvoiceCount).toBe(4)
    const where = mockPrisma.document.count.mock.calls[0][0].where
    expect(where.status).toEqual({ not: 'DRAFT' })
    expect(where.balanceDue).toEqual({ gt: 0 })
  })
})

describe('documentLedgerStatus', () => {
  const now = new Date('2026-07-22T00:00:00Z')
  const past = new Date('2026-07-01T00:00:00Z')
  const future = new Date('2026-08-01T00:00:00Z')

  it('calls a draft a draft regardless of balance', () => {
    expect(
      documentLedgerStatus({ status: 'DRAFT', balanceDue: 5000, grandTotal: 5000, dueDate: past }, now),
    ).toBe('DRAFT')
  })

  it('calls a settled invoice paid even when its due date has passed', () => {
    expect(
      documentLedgerStatus({ status: 'SENT', balanceDue: 0, grandTotal: 5000, dueDate: past }, now),
    ).toBe('PAID')
  })

  it('prefers OVERDUE over PARTIAL on a part-paid invoice past its due date', () => {
    expect(
      documentLedgerStatus({ status: 'SENT', balanceDue: 2000, grandTotal: 5000, dueDate: past }, now),
    ).toBe('OVERDUE')
  })

  it('calls a part-paid, not-yet-due invoice partial', () => {
    expect(
      documentLedgerStatus({ status: 'SENT', balanceDue: 2000, grandTotal: 5000, dueDate: future }, now),
    ).toBe('PARTIAL')
  })

  it('calls an untouched, not-yet-due invoice pending', () => {
    expect(
      documentLedgerStatus({ status: 'SENT', balanceDue: 5000, grandTotal: 5000, dueDate: future }, now),
    ).toBe('PENDING')
  })

  it('treats a missing due date as not overdue', () => {
    expect(
      documentLedgerStatus({ status: 'SENT', balanceDue: 5000, grandTotal: 5000, dueDate: null }, now),
    ).toBe('PENDING')
  })
})
