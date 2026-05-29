/**
 * Single-writer unit tests — postLedgerDeltas / repairLedgerBalance.
 *
 * These pass their OWN fake tx (an in-memory balance Map) so they assert the
 * exact arithmetic of the one balance writer in isolation, independent of the
 * global prisma mock. The canonical sign convention is balanceDelta:
 *   DEBIT_NORMAL (ASSET/EXPENSE) → debit − credit
 *   else (LIABILITY/EQUITY/INCOME) → credit − debit
 */
import { describe, it, expect } from 'vitest'
import { postLedgerDeltas, repairLedgerBalance, type BalanceLine } from '../posting/ledger-deltas.js'

/** Minimal tx whose ledgerAccount.update applies {balance:{increment}} to a Map. */
function fakeTx(initial: Record<string, number> = {}) {
  const balances = new Map<string, number>(Object.entries(initial))
  const tx = {
    ledgerAccount: {
      update: async ({ where, data }: { where: { id: string }; data: { balance: { increment: number } } }) => {
        balances.set(where.id, (balances.get(where.id) ?? 0) + data.balance.increment)
        return {}
      },
    },
  }
  return { tx: tx as never, balances }
}

describe('postLedgerDeltas — canonical sign convention', () => {
  it('credit-normal (INCOME/LIABILITY/EQUITY) increases on credit, debit-normal (ASSET/EXPENSE) increases on debit', async () => {
    const { tx, balances } = fakeTx()
    const lines: BalanceLine[] = [
      { accountId: 'income', accountType: 'INCOME', debit: 0, credit: 1000 },
      { accountId: 'asset', accountType: 'ASSET', debit: 1000, credit: 0 },
      { accountId: 'expense', accountType: 'EXPENSE', debit: 700, credit: 0 },
      { accountId: 'liability', accountType: 'LIABILITY', debit: 0, credit: 700 },
      { accountId: 'equity', accountType: 'EQUITY', debit: 0, credit: 300 },
    ]
    await postLedgerDeltas(tx, lines)
    expect(balances.get('income')).toBe(1000) // credit − debit
    expect(balances.get('asset')).toBe(1000) // debit − credit
    expect(balances.get('expense')).toBe(700)
    expect(balances.get('liability')).toBe(700)
    expect(balances.get('equity')).toBe(300)
  })

  it('reverse:true negates every delta, exactly undoing a prior post', async () => {
    const lines: BalanceLine[] = [
      { accountId: 'income', accountType: 'INCOME', debit: 0, credit: 1000 },
      { accountId: 'asset', accountType: 'ASSET', debit: 1000, credit: 0 },
    ]
    const { tx, balances } = fakeTx()
    await postLedgerDeltas(tx, lines)
    await postLedgerDeltas(tx, lines, { reverse: true })
    expect(balances.get('income')).toBe(0)
    expect(balances.get('asset')).toBe(0)
  })

  it('contra legs: INCOME net-debit and EXPENSE net-credit produce the right sign', async () => {
    const { tx, balances } = fakeTx()
    await postLedgerDeltas(tx, [
      { accountId: 'contra-income', accountType: 'INCOME', debit: 500, credit: 0 }, // sales return
      { accountId: 'refund-exp', accountType: 'EXPENSE', debit: 0, credit: 200 }, // expense refund
    ])
    expect(balances.get('contra-income')).toBe(-500) // credit − debit
    expect(balances.get('refund-exp')).toBe(-200) // debit − credit
  })

  it('skips zero-delta lines (no write)', async () => {
    let writes = 0
    const tx = {
      ledgerAccount: { update: async () => { writes++; return {} } },
    } as never
    await postLedgerDeltas(tx, [{ accountId: 'x', accountType: 'ASSET', debit: 500, credit: 500 }])
    expect(writes).toBe(0)
  })
})

describe('repairLedgerBalance — drift correction', () => {
  it('applies a signed correction toward the derived truth', async () => {
    const { tx, balances } = fakeTx({ acct: 800 })
    await repairLedgerBalance(tx, 'acct', 200) // derived 1000, stored 800 → +200
    expect(balances.get('acct')).toBe(1000)
  })

  it('is a no-op when the correction is zero (no drift)', async () => {
    let writes = 0
    const tx = { ledgerAccount: { update: async () => { writes++; return {} } } } as never
    await repairLedgerBalance(tx, 'acct', 0)
    expect(writes).toBe(0)
  })
})
