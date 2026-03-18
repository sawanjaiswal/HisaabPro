import { describe, it, expect } from 'vitest'
import {
  formatBalance,
  formatEntryDate,
  groupAccountsByType,
  sumGroupBalance,
  isBalanced,
  buildAccountingQuery,
} from '../accounting.utils'
import type { LedgerAccount, AccountType } from '../accounting.types'
import { ACCOUNT_TYPE_ORDER } from '../accounting.constants'

// ─── Balance formatting ─────────────────────────────────────────────────────

describe('formatBalance', () => {
  it('formats positive balance', () => {
    const result = formatBalance(150000)
    expect(result).toContain('1,500')
    expect(result).not.toMatch(/^-/)
  })

  it('formats negative balance with leading minus', () => {
    const result = formatBalance(-150000)
    expect(result).toMatch(/^-/)
    expect(result).toContain('1,500')
  })

  it('formats zero', () => {
    const result = formatBalance(0)
    expect(result).toContain('0.00')
    expect(result).not.toMatch(/^-/)
  })

  it('formats small amount (1 paisa)', () => {
    const result = formatBalance(1)
    expect(result).toContain('0.01')
  })

  it('formats large amount (Rs 10,00,000)', () => {
    const result = formatBalance(100_000_000)
    expect(result).toContain('10,00,000')
  })
})

// ─── Entry date formatting ──────────────────────────────────────────────────

describe('formatEntryDate', () => {
  it('formats ISO date to Indian readable format', () => {
    const result = formatEntryDate('2026-03-17')
    expect(result).toMatch(/17/)
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/2026/)
  })

  it('formats first day of year', () => {
    const result = formatEntryDate('2026-01-01')
    expect(result).toMatch(/01/)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/2026/)
  })
})

// ─── Account grouping ──────────────────────────────────────────────────────

describe('groupAccountsByType', () => {
  const makeAccount = (id: string, type: AccountType, balance: number): LedgerAccount => ({
    id,
    code: id,
    name: `Account ${id}`,
    type,
    subType: null,
    parentId: null,
    description: null,
    isSystem: false,
    isActive: true,
    balance,
  })

  it('groups accounts by type with all types present', () => {
    const accounts: LedgerAccount[] = [
      makeAccount('1', 'ASSET', 10000),
      makeAccount('2', 'LIABILITY', 5000),
      makeAccount('3', 'ASSET', 20000),
      makeAccount('4', 'INCOME', 8000),
    ]
    const grouped = groupAccountsByType(accounts)
    expect(grouped.get('ASSET')).toHaveLength(2)
    expect(grouped.get('LIABILITY')).toHaveLength(1)
    expect(grouped.get('INCOME')).toHaveLength(1)
    expect(grouped.get('EQUITY')).toHaveLength(0)
    expect(grouped.get('EXPENSE')).toHaveLength(0)
  })

  it('creates empty arrays for all account types even with empty input', () => {
    const grouped = groupAccountsByType([])
    for (const type of ACCOUNT_TYPE_ORDER) {
      expect(grouped.get(type)).toEqual([])
    }
  })

  it('preserves order of types from ACCOUNT_TYPE_ORDER', () => {
    const grouped = groupAccountsByType([])
    const keys = Array.from(grouped.keys())
    expect(keys).toEqual(ACCOUNT_TYPE_ORDER)
  })
})

// ─── Sum group balance ──────────────────────────────────────────────────────

describe('sumGroupBalance', () => {
  const makeAccount = (balance: number): LedgerAccount => ({
    id: '1',
    code: '1',
    name: 'Test',
    type: 'ASSET',
    subType: null,
    parentId: null,
    description: null,
    isSystem: false,
    isActive: true,
    balance,
  })

  it('sums positive balances', () => {
    expect(sumGroupBalance([makeAccount(10000), makeAccount(20000)])).toBe(30000)
  })

  it('handles negative balances', () => {
    expect(sumGroupBalance([makeAccount(-5000), makeAccount(10000)])).toBe(5000)
  })

  it('returns 0 for empty array', () => {
    expect(sumGroupBalance([])).toBe(0)
  })

  it('returns single balance for one account', () => {
    expect(sumGroupBalance([makeAccount(42000)])).toBe(42000)
  })
})

// ─── Trial balance check ───────────────────────────────────────────────────

describe('isBalanced', () => {
  it('returns true when debits equal credits', () => {
    expect(isBalanced(500000, 500000)).toBe(true)
  })

  it('returns false when debits differ from credits', () => {
    expect(isBalanced(500000, 499999)).toBe(false)
  })

  it('returns true for both zero', () => {
    expect(isBalanced(0, 0)).toBe(true)
  })
})

// ─── Query string builder ───────────────────────────────────────────────────

describe('buildAccountingQuery', () => {
  it('builds query from params', () => {
    const result = buildAccountingQuery({ type: 'ASSET', page: 1 })
    expect(result).toContain('type=ASSET')
    expect(result).toContain('page=1')
  })

  it('skips undefined values', () => {
    const result = buildAccountingQuery({ type: 'ASSET', status: undefined })
    expect(result).toBe('type=ASSET')
  })

  it('skips empty string values', () => {
    const result = buildAccountingQuery({ search: '' })
    expect(result).toBe('')
  })

  it('encodes special characters', () => {
    const result = buildAccountingQuery({ name: 'Cash & Bank' })
    expect(result).toContain('Cash%20%26%20Bank')
  })

  it('returns empty string when all params are undefined', () => {
    const result = buildAccountingQuery({ a: undefined, b: undefined })
    expect(result).toBe('')
  })
})
