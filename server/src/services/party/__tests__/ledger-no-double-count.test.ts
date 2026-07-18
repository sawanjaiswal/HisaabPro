/**
 * Party ledger — must not double-count auto-posted GL journal lines.
 *
 * A SALE_INVOICE appears as a DOCUMENT row; GL auto-posting also creates a
 * party-tagged Accounts-Receivable journal line for the same invoice. The
 * ledger must exclude journal entries sourced from DOCUMENT/PAYMENT so the
 * receivable is counted once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../../lib/prisma.js'
import { getPartyLedger } from '../ledger.service.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BIZ = 'biz-1'
const PARTY = 'party-1'
const QUERY = { from: '2026-04-01', to: '2027-03-31', voucherTypes: undefined, cursor: undefined, limit: 50 } as never

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.party.findFirst.mockResolvedValue({ id: PARTY, name: 'Acme' })
  // Opening-balance queries (before window) — all empty.
  // Window queries — one sale document, no payments, no *manual* journal lines.
  mockPrisma.document.findMany.mockResolvedValue([])
  mockPrisma.payment.findMany.mockResolvedValue([])
  mockPrisma.journalEntryLine.findMany.mockResolvedValue([])
})

describe('getPartyLedger — no double count', () => {
  it('excludes DOCUMENT/PAYMENT-sourced journal lines in both queries', async () => {
    await getPartyLedger(BIZ, PARTY, QUERY)
    const calls = mockPrisma.journalEntryLine.findMany.mock.calls
    expect(calls.length).toBe(2) // opening + window
    for (const [arg] of calls) {
      expect(arg.where.journalEntry.sourceType).toEqual({ notIn: ['DOCUMENT', 'PAYMENT'] })
    }
  })

  it('counts a sale invoice once (document row only, mirror JE excluded)', async () => {
    mockPrisma.document.findMany
      .mockResolvedValueOnce([]) // opening
      .mockResolvedValueOnce([{
        id: 'inv-1', type: 'SALE_INVOICE', grandTotal: 20000,
        documentDate: new Date('2026-07-18'), documentNumber: 'INV-1',
        createdAt: new Date('2026-07-18'), party: { name: 'Acme' }, _count: { lineItems: 1 },
      }])
    const res = await getPartyLedger(BIZ, PARTY, QUERY)
    expect(res.closingBalance).toBe(20000)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].source).toBe('DOCUMENT')
  })
})
