/** Accounting — Pure utility functions */

import type { LedgerAccount, AccountType } from './accounting.types'
import { ACCOUNT_TYPE_ORDER } from './accounting.constants'

// ─── Currency formatting ───────────────────────────────────────────────────────

export { formatPaise } from '@/lib/format'

/** Format with sign for balance (negative = red) */
export function formatBalance(paise: number): string {
  const abs = Math.abs(paise)
  const sign = paise < 0 ? '-' : ''
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs / 100)
  return sign + formatted
}

// ─── Date utilities ────────────────────────────────────────────────────────────

/** Format ISO date string to readable Indian date: "2026-03-17" → "17 Mar 2026" */
export function formatEntryDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Get today in YYYY-MM-DD format */
export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Account grouping ──────────────────────────────────────────────────────────

/** Group flat account list by AccountType in canonical order */
export function groupAccountsByType(
  accounts: LedgerAccount[]
): Map<AccountType, LedgerAccount[]> {
  const map = new Map<AccountType, LedgerAccount[]>()

  for (const type of ACCOUNT_TYPE_ORDER) {
    map.set(type, [])
  }

  for (const account of accounts) {
    const group = map.get(account.type)
    if (group) group.push(account)
  }

  return map
}

/** Sum balances for a group of accounts (paise) */
export function sumGroupBalance(accounts: LedgerAccount[]): number {
  return accounts.reduce((sum, a) => sum + a.balance, 0)
}

// ─── Trial balance helpers ─────────────────────────────────────────────────────

/** Determine if a trial balance is balanced (debits === credits) */
export function isBalanced(totalDebit: number, totalCredit: number): boolean {
  return totalDebit === totalCredit
}

/** Build query string from non-empty filter values */
export function buildAccountingQuery(
  params: Record<string, string | number | undefined>
): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.join('&')
}
