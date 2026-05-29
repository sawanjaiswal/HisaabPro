/**
 * Reconciler + SSOT invariant tests.
 *
 * The global setup (src/__tests__/setup.ts) mocks prisma so that
 * `$transaction(fn)` runs `fn(proxy)` — i.e. tx === the mocked prisma. We wire
 * an in-memory ledger onto that mock: accounts carry a `balance`, journal lines
 * live on POSTED entries, and `ledgerAccount.update {balance:{increment}}`
 * mutates the in-memory balance. This lets us assert the real invariant:
 * stored balance == SUM(POSTED JournalLine via balanceDelta) after each step.
 *
 * The wrong-sign + net-loss close→reopen case is the MUST_FIX #1 regression
 * guard: a contra-income (net-debit) and an expense-refund (net-credit) account
 * must both be driven to 0 on close (proving a closing line is emitted
 * regardless of sign), and restored on reopen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../../../lib/prisma.js'
import { reconcileLedgerBalances } from '../reconcile-balances.js'
import { closeFY } from '../../fy-closure/close.js'
import { reopenFY } from '../../fy-closure/reopen.js'

type Acct = { id: string; code: string; type: string; name: string; balance: number }
type Line = { accountId: string; debit: number; credit: number; account: { id: string; name: string; type: string; balance: number } }
type Entry = { id: string; status: string; lines: Line[] }

/** Wires the global prisma mock onto an in-memory ledger. */
function makeLedger() {
  const accounts = new Map<string, Acct>()
  const entries: Entry[] = []
  let closureRow: Record<string, unknown> | null = null

  const addAccount = (a: Acct) => accounts.set(a.id, { ...a })
  const lineFor = (accountId: string, debit: number, credit: number): Line => {
    const a = accounts.get(accountId)!
    return { accountId, debit, credit, account: { id: a.id, name: a.name, type: a.type, balance: a.balance } }
  }
  const addPostedEntry = (id: string, legs: Array<[string, number, number]>) =>
    entries.push({ id, status: 'POSTED', lines: legs.map(([acc, d, c]) => lineFor(acc, d, c)) })
  const postedLines = () => entries.filter((e) => e.status === 'POSTED').flatMap((e) => e.lines)

  vi.mocked(prisma.ledgerAccount.findMany).mockImplementation((() =>
    Promise.resolve([...accounts.values()].map((a) => ({ id: a.id, code: a.code, balance: a.balance })))) as never)

  vi.mocked(prisma.ledgerAccount.update).mockImplementation(((args: { where: { id: string }; data: { balance?: { increment?: number } } }) => {
    const a = accounts.get(args.where.id)
    const inc = args.data?.balance?.increment
    if (a && typeof inc === 'number') a.balance += inc
    return Promise.resolve({})
  }) as never)

  vi.mocked(prisma.ledgerAccount.findFirst).mockImplementation(((args: { where?: { code?: string } }) => {
    const re = [...accounts.values()].find((a) => a.code === args.where?.code)
    return Promise.resolve(re ? { id: re.id, name: re.name, balance: re.balance } : null)
  }) as never)

  vi.mocked(prisma.journalEntryLine.findMany).mockImplementation(((args: { where?: { account?: { type?: { in?: string[] } } } }) => {
    const typeIn = args?.where?.account?.type?.in
    let lines = postedLines()
    if (typeIn) lines = lines.filter((l) => typeIn.includes(l.account.type))
    return Promise.resolve(lines)
  }) as never)

  vi.mocked(prisma.journalEntry.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.journalEntry.create).mockImplementation(((args: { data: { lines: { create: Array<{ accountId: string; debit: number; credit: number }> } } }) => {
    const legs = args.data.lines.create.map((l) => lineFor(l.accountId, l.debit, l.credit))
    entries.push({ id: 'closing', status: 'POSTED', lines: legs })
    return Promise.resolve({ id: 'closing' })
  }) as never)

  vi.mocked(prisma.journalEntry.findUnique).mockImplementation((() => {
    const e = entries.find((x) => x.id === 'closing')
    return Promise.resolve(e ? { id: e.id, status: e.status, lines: e.lines } : null)
  }) as never)
  vi.mocked(prisma.journalEntry.update).mockImplementation((() => {
    const e = entries.find((x) => x.id === 'closing')
    if (e) e.status = 'VOID'
    return Promise.resolve({})
  }) as never)

  vi.mocked(prisma.financialYearClosure.findUnique).mockImplementation((() => Promise.resolve(closureRow)) as never)
  vi.mocked(prisma.financialYearClosure.upsert).mockResolvedValue({ id: 'clo' } as never)
  vi.mocked(prisma.financialYearClosure.update).mockResolvedValue({ id: 'clo' } as never)

  return {
    accounts,
    addAccount,
    addPostedEntry,
    setClosure: (row: Record<string, unknown> | null) => { closureRow = row },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('reconcileLedgerBalances — drift detection & repair', () => {
  it('detects drift without repairing when repair=false', async () => {
    const led = makeLedger()
    led.addAccount({ id: 'cash', code: '1000', type: 'ASSET', name: 'Cash', balance: 999 }) // wrong
    led.addPostedEntry('ops', [['cash', 1000, 0]]) // derived = 1000
    const res = await reconcileLedgerBalances('biz', { repair: false })
    expect(res.checked).toBe(1)
    expect(res.repaired).toBe(0)
    expect(res.drifted).toEqual([{ accountId: 'cash', code: '1000', stored: 999, derived: 1000, diff: 1 }])
    expect(led.accounts.get('cash')!.balance).toBe(999) // untouched
  })

  it('repairs drift toward the journal-line truth when repair=true', async () => {
    const led = makeLedger()
    led.addAccount({ id: 'cash', code: '1000', type: 'ASSET', name: 'Cash', balance: 999 })
    led.addPostedEntry('ops', [['cash', 1000, 0]])
    const res = await reconcileLedgerBalances('biz', { repair: true })
    expect(res.repaired).toBe(1)
    expect(led.accounts.get('cash')!.balance).toBe(1000)
  })

  it('a freshly-created account with no journal lines is consistent (genesis balance 0)', async () => {
    const led = makeLedger()
    led.addAccount({ id: 'new', code: '4100', type: 'INCOME', name: 'Other Income', balance: 0 })
    const res = await reconcileLedgerBalances('biz', { repair: true })
    expect(res.drifted).toEqual([])
    expect(res.repaired).toBe(0)
  })
})

describe('MUST_FIX #1 — wrong-sign + net-loss close→reopen keeps stored == derived', () => {
  it('zeroes contra-income (net-debit) and expense-refund (net-credit) on close, restores on reopen', async () => {
    const led = makeLedger()
    // Ops entry (balanced): contra-income net DEBIT, expense-refund net CREDIT.
    led.addAccount({ id: 'inc', code: '4000', type: 'INCOME', name: 'Sales', balance: -500 })
    led.addAccount({ id: 'exp', code: '5000', type: 'EXPENSE', name: 'Purchases', balance: -300 })
    led.addAccount({ id: 'cash', code: '1000', type: 'ASSET', name: 'Cash', balance: -200 })
    led.addAccount({ id: 're', code: '3100', type: 'EQUITY', name: 'Retained Earnings', balance: 0 })
    // inc: cr300/dr800 → net credit−debit = −500 (net debit). exp: dr100/cr400 → debit−credit = −300 (net credit).
    led.addPostedEntry('ops', [['inc', 800, 0], ['inc', 0, 300], ['exp', 100, 0], ['exp', 0, 400], ['cash', 0, 200]])

    // Pre-close: stored == derived for all.
    let res = await reconcileLedgerBalances('biz', { repair: false })
    expect(res.drifted).toEqual([])

    // Close FY (net loss: income −500, expense −300 → netProfit −200).
    const closeResult = await closeFY('biz', 'user', '2526')
    expect(closeResult.netProfit).toBe(-200)
    expect(led.accounts.get('inc')!.balance).toBe(0) // contra-income driven to 0
    expect(led.accounts.get('exp')!.balance).toBe(0) // expense-refund driven to 0
    expect(led.accounts.get('re')!.balance).toBe(-200) // net loss to RE

    // Post-close: still no drift (closing lines are now part of the derived sum).
    res = await reconcileLedgerBalances('biz', { repair: false })
    expect(res.drifted).toEqual([])

    // Reopen: void the closing entry and restore balances.
    led.setClosure({ id: 'clo', status: 'CLOSED', journalEntryId: 'closing', retainedEarnings: -200 })
    await reopenFY('biz', '2526')
    expect(led.accounts.get('inc')!.balance).toBe(-500) // restored
    expect(led.accounts.get('exp')!.balance).toBe(-300)
    expect(led.accounts.get('re')!.balance).toBe(0)

    // Post-reopen: closing entry VOID, derived back to ops only — no drift.
    res = await reconcileLedgerBalances('biz', { repair: false })
    expect(res.drifted).toEqual([])
  })
})
