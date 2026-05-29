/**
 * FY-closure regression — N4: Retained Earnings lookup must match the seeded
 * account (code 3100, subType null), not a nonexistent subType:'CAPITAL' row.
 * Trace: .claude/fix-trace-fy-closure-re.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { closeFY } from '../close.js'
import { prisma } from '../../../lib/prisma.js'

// Seed-accurate Retained Earnings row, per chart-of-accounts.ts:29.
const SEEDED_RE = { id: 're-acct', code: '3100', name: 'Retained Earnings', type: 'EQUITY', subType: null as string | null, balance: 0 }

/** Emulates a real DB findFirst against the single seeded Retained Earnings row. */
function matchSeededRE(args: { where?: Record<string, unknown> } | undefined) {
  const where = args?.where ?? {}
  if (where.type !== undefined && where.type !== SEEDED_RE.type) return null
  if (where.code !== undefined && where.code !== SEEDED_RE.code) return null
  if (where.subType !== undefined && where.subType !== SEEDED_RE.subType) return null
  const nameFilter = where.name as { contains?: string } | undefined
  if (nameFilter?.contains && !SEEDED_RE.name.includes(nameFilter.contains)) return null
  return { id: SEEDED_RE.id, name: SEEDED_RE.name, balance: SEEDED_RE.balance }
}

describe('closeFY — Retained Earnings resolution (N4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.financialYearClosure.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.journalEntry.count).mockResolvedValue(0)
    // INCOME 100000 credit, EXPENSE 40000 debit → net profit 60000
    vi.mocked(prisma.journalEntryLine.findMany).mockResolvedValue([
      { accountId: 'inc-1', debit: 0, credit: 100000, account: { id: 'inc-1', name: 'Sales Revenue', type: 'INCOME', balance: 100000 } },
      { accountId: 'exp-1', debit: 40000, credit: 0, account: { id: 'exp-1', name: 'Purchases', type: 'EXPENSE', balance: 40000 } },
    ] as never)
    vi.mocked(prisma.ledgerAccount.findFirst).mockImplementation(matchSeededRE as never)
  })

  it('resolves the seeded Retained Earnings account and posts the closing entry', async () => {
    const result = await closeFY('biz-1', 'user-1', '2526')
    expect(result.netProfit).toBe(60000)
    // Closing entry must be posted (would never reach here if RE lookup threw)
    expect(prisma.journalEntry.create).toHaveBeenCalledTimes(1)
    const createArg = vi.mocked(prisma.journalEntry.create).mock.calls[0][0] as { data: { lines: { create: Array<{ accountId: string; credit: number }> } } }
    const reLine = createArg.data.lines.create.find((l) => l.accountId === SEEDED_RE.id)
    expect(reLine).toBeDefined()
    expect(reLine?.credit).toBe(60000) // net profit credited to RE
  })

  it('does not filter the lookup by subType:CAPITAL (the seeded RE has subType null)', async () => {
    await closeFY('biz-1', 'user-1', '2526')
    const where = vi.mocked(prisma.ledgerAccount.findFirst).mock.calls[0][0]?.where as Record<string, unknown>
    expect(where.subType).not.toBe('CAPITAL')
  })
})
